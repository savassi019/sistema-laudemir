import "server-only";

import type {
  EmployeeExpenseCategory,
  EmployeeExpenseFunding,
  PaymentMethod,
  Prisma,
  SystemModule,
} from "@prisma/client";
import { z } from "zod";

import { canReviewEmployeeCash } from "@/lib/access-policy";
import { hasModuleAccess } from "@/lib/auth";
import { currentBusinessDate } from "@/lib/business-date";
import { calculateEmployeeCashTotals } from "@/lib/employee-cash";
import { prisma } from "@/lib/prisma";
import {
  EMPLOYEE_EXPENSE_CATEGORY_LABEL,
  EMPLOYEE_EXPENSE_FUNDING_LABEL,
  PAYMENT_METHOD_LABEL,
  rotuloDeStatus,
} from "@/lib/status-labels";
import { assertBusinessDayOpen } from "@/server/services/business-day-lock-service";
import type { SessionData } from "@/types/app";

export const EMPLOYEE_CASH_MODULES = new Set<SystemModule>([
  "CARRETA_KIDS",
  "RENTAL",
  "PLUSH",
  "BILLIARD",
  "BRASIL_BETS",
  "MACHINE",
  "CONDOMINIUM_MARKET",
  "PERSONAL_FINANCE",
  "BX",
  "SLOT_H",
]);

const businessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((value) => value <= currentBusinessDate(), "Não é permitido lançar uma data futura.");

const moneySchema = z.coerce
  .number()
  .finite("Informe um valor válido.")
  .min(0, "O valor não pode ser negativo.")
  .max(1_000_000, "O valor informado é muito alto.");

const employeeExpenseInputSchema = z.object({
  businessDate: businessDateSchema,
  advanceAmount: moneySchema,
  category: z.enum(["MEAL", "FUEL", "TOLL", "OTHER"]),
  amount: moneySchema.refine((value) => value >= 0.01, "Informe o valor do gasto."),
  funding: z.enum(["COMPANY_ADVANCE", "EMPLOYEE_OWN", "COMPANY_DIRECT"]),
  paymentMethod: z.enum([
    "CASH",
    "PIX",
    "CREDIT_CARD",
    "DEBIT_CARD",
    "BANK_TRANSFER",
    "BOLETO",
    "CHECK",
    "OTHER",
  ]),
  notes: z.string().trim().max(1000, "A observação é muito longa.").nullish(),
  employeeNotes: z.string().trim().max(1000, "A observação é muito longa.").nullish(),
  proofFileId: z.string().min(1, "Envie o comprovante.").max(191),
});

type EmployeeExpenseInput = z.infer<typeof employeeExpenseInputSchema>;

const advanceInputSchema = z.object({
  businessDate: businessDateSchema,
  advanceAmount: moneySchema,
  employeeNotes: z.string().trim().max(1000, "A observação é muito longa.").nullish(),
});

const reviewInputSchema = z
  .object({
    decision: z.enum(["APPROVE", "RETURN"]),
    notes: z.string().trim().max(1000, "A observação é muito longa.").nullish(),
  })
  .superRefine((input, context) => {
    if (input.decision === "RETURN" && (input.notes?.length ?? 0) < 3) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Explique o que o funcionário precisa corrigir.",
      });
    }
  });

const cashInclude = {
  employee: { select: { name: true } },
  reviewedBy: { select: { name: true } },
  expenses: {
    where: { employeeExpenseCategory: { not: null } },
    include: {
      payments: {
        select: { proofFileId: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.EmployeeDailyCashInclude;

type CashWithExpenses = Prisma.EmployeeDailyCashGetPayload<{
  include: typeof cashInclude;
}>;

export type EmployeeExpenseItem = {
  id: string;
  category: string;
  categoryLabel: string;
  funding: string;
  fundingLabel: string;
  amount: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  notes: string | null;
  proofFileId: string | null;
  cancelled: boolean;
  createdAt: string;
};

export type EmployeeCashTotalsItem = ReturnType<typeof calculateEmployeeCashTotals>;

export type EmployeeCashBoxItem = {
  id: string;
  businessDate: string;
  employeeName: string;
  isOwn: boolean;
  status: "OPEN" | "SUBMITTED" | "APPROVED" | "RETURNED";
  advanceAmount: number;
  employeeNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewNotes: string | null;
  expenses: EmployeeExpenseItem[];
  totals: EmployeeCashTotalsItem | null;
};

export class EmployeeExpenseAlreadyReceivedError extends Error {}

function storedBusinessDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function assertEmployeeCashAccess(session: SessionData, module: SystemModule) {
  // ASVS V8.2/V8.3: a permissao e conferida novamente no servico, nao apenas na tela.
  if (!EMPLOYEE_CASH_MODULES.has(module) || !hasModuleAccess(session, module)) {
    throw new Error("Sem permissão para os gastos deste módulo.");
  }
}

function mapExpense(row: CashWithExpenses["expenses"][number]): EmployeeExpenseItem {
  const category = row.employeeExpenseCategory ?? "OTHER";
  const funding = row.employeeExpenseFunding ?? "COMPANY_DIRECT";
  const paymentMethod = row.paymentMethod ?? "OTHER";

  return {
    id: row.id,
    category,
    categoryLabel: rotuloDeStatus(category, EMPLOYEE_EXPENSE_CATEGORY_LABEL),
    funding,
    fundingLabel: rotuloDeStatus(funding, EMPLOYEE_EXPENSE_FUNDING_LABEL),
    amount: Number(row.totalAmount),
    paymentMethod,
    paymentMethodLabel: rotuloDeStatus(paymentMethod, PAYMENT_METHOD_LABEL),
    notes: row.notes,
    proofFileId: row.payments.find((payment) => payment.proofFileId)?.proofFileId ?? null,
    cancelled: row.status === "CANCELLED",
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCashBox(session: SessionData, row: CashWithExpenses): EmployeeCashBoxItem {
  const expenses = row.expenses.map(mapExpense);
  const totals = canReviewEmployeeCash(session.role)
    ? calculateEmployeeCashTotals(
        Number(row.advanceAmount),
        row.expenses.map((expense) => ({
          amount: Number(expense.totalAmount),
          funding: expense.employeeExpenseFunding ?? "COMPANY_DIRECT",
          cancelled: expense.status === "CANCELLED",
        })),
      )
    : null;

  return {
    id: row.id,
    businessDate: row.businessDate.toISOString().slice(0, 10),
    employeeName: row.employee.name,
    isOwn: row.employeeId === session.userId,
    status: row.status,
    advanceAmount: Number(row.advanceAmount),
    employeeNotes: row.employeeNotes,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedByName: row.reviewedBy?.name ?? null,
    reviewNotes: row.reviewNotes,
    expenses,
    totals,
  };
}

async function getCashBoxItem(session: SessionData, id: string) {
  const row = await prisma.employeeDailyCash.findFirstOrThrow({
    where: {
      id,
      organizationId: session.organizationId,
      ...(canReviewEmployeeCash(session.role) ? {} : { employeeId: session.userId }),
    },
    include: cashInclude,
  });
  return mapCashBox(session, row);
}

export async function listEmployeeCashBoxes(
  session: SessionData,
  module: SystemModule,
  businessDate: string,
): Promise<EmployeeCashBoxItem[]> {
  assertEmployeeCashAccess(session, module);
  const date = businessDateSchema.parse(businessDate);
  const rows = await prisma.employeeDailyCash.findMany({
    where: {
      organizationId: session.organizationId,
      module,
      businessDate: storedBusinessDate(date),
      ...(canReviewEmployeeCash(session.role) ? {} : { employeeId: session.userId }),
    },
    include: cashInclude,
    orderBy: [{ status: "asc" }, { employee: { name: "asc" } }],
  });
  return rows.map((row) => mapCashBox(session, row));
}

async function ensureEditableCash(
  tx: Prisma.TransactionClient,
  session: SessionData,
  module: SystemModule,
  businessDate: string,
) {
  const cash = await tx.employeeDailyCash.upsert({
    where: {
      organizationId_employeeId_module_businessDate: {
        organizationId: session.organizationId,
        employeeId: session.userId,
        module,
        businessDate: storedBusinessDate(businessDate),
      },
    },
    update: {},
    create: {
      organizationId: session.organizationId,
      employeeId: session.userId,
      module,
      businessDate: storedBusinessDate(businessDate),
    },
  });

  if (cash.status !== "OPEN" && cash.status !== "RETURNED") {
    throw new Error("Este caixa já foi enviado e não pode mais ser alterado.");
  }
  return cash;
}

export async function saveEmployeeCashAdvance(
  session: SessionData,
  module: SystemModule,
  payload: unknown,
) {
  assertEmployeeCashAccess(session, module);
  // ASVS V2.2: toda entrada e validada novamente na fronteira do servidor.
  const input = advanceInputSchema.parse(payload);
  await assertBusinessDayOpen(session, input.businessDate);

  const cashId = await prisma.$transaction(async (tx) => {
    const cash = await ensureEditableCash(tx, session, module, input.businessDate);
    await tx.employeeDailyCash.update({
      where: { id: cash.id },
      data: {
        advanceAmount: input.advanceAmount,
        employeeNotes: input.employeeNotes || null,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module,
        action: "EMPLOYEE_CASH_ADVANCE_SAVED",
        entityType: "OTHER",
        entityId: cash.id,
        newData: { businessDate: input.businessDate, advanceAmount: input.advanceAmount },
      },
    });
    return cash.id;
  });

  return getCashBoxItem(session, cashId);
}

async function createEmployeeExpenseInTransaction(
  tx: Prisma.TransactionClient,
  session: SessionData,
  module: SystemModule,
  input: EmployeeExpenseInput,
): Promise<EmployeeExpenseItem> {
  const proof = await tx.fileAsset.findFirst({
    where: {
      id: input.proofFileId,
      organizationId: session.organizationId,
      uploadedById: session.userId,
      category: { in: ["PROOF", "PHOTO"] },
      entityId: null,
    },
    select: { id: true },
  });
  if (!proof) {
    throw new Error("O comprovante não pertence a este funcionário ou já foi utilizado.");
  }

  const category = input.category as EmployeeExpenseCategory;
  const funding = input.funding as EmployeeExpenseFunding;
  const paymentMethod = input.paymentMethod as PaymentMethod;
  const categoryLabel = rotuloDeStatus(category, EMPLOYEE_EXPENSE_CATEGORY_LABEL);
  const expenseDate = storedBusinessDate(input.businessDate);
  const cash = await ensureEditableCash(tx, session, module, input.businessDate);
  const financialCategory = await tx.financialCategory.upsert({
    where: {
      organizationId_name: {
        organizationId: session.organizationId,
        name: `Gasto da equipe - ${categoryLabel}`,
      },
    },
    update: { isActive: true },
    create: {
      organizationId: session.organizationId,
      name: `Gasto da equipe - ${categoryLabel}`,
      direction: "EXPENSE",
    },
  });

  await tx.employeeDailyCash.update({
    where: { id: cash.id },
    data: {
      advanceAmount: input.advanceAmount,
      employeeNotes: input.employeeNotes || null,
    },
  });

  const entry = await tx.financialEntry.create({
    data: {
      organizationId: session.organizationId,
      categoryId: financialCategory.id,
      module,
      kind: "EXPENSE",
      direction: "EXPENSE",
      status: "PAID",
      description: `${categoryLabel} - ${session.name}`,
      referenceCode: `FUNC-${input.businessDate.replaceAll("-", "")}`,
      sourceEntityType: "OTHER",
      sourceEntityId: cash.id,
      issueDate: expenseDate,
      paidAt: expenseDate,
      totalAmount: input.amount,
      paidAmount: input.amount,
      remainingAmount: 0,
      paymentMethod,
      notes: input.notes || null,
      employeeDailyCashId: cash.id,
      employeeExpenseCategory: category,
      employeeExpenseFunding: funding,
      createdById: session.userId,
    },
  });

  const attached = await tx.fileAsset.updateMany({
    where: {
      id: input.proofFileId,
      organizationId: session.organizationId,
      uploadedById: session.userId,
      entityId: null,
    },
    data: { entityType: "FINANCIAL_ENTRY", entityId: entry.id },
  });
  if (attached.count !== 1) {
    throw new Error("Este comprovante já foi utilizado em outro gasto.");
  }

  await tx.payment.create({
    data: {
      organizationId: session.organizationId,
      financialEntryId: entry.id,
      amount: input.amount,
      paymentDate: expenseDate,
      method: paymentMethod,
      proofFileId: input.proofFileId,
      notes: input.notes || null,
      createdById: session.userId,
    },
  });
  await tx.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      module,
      action: "EMPLOYEE_EXPENSE_CREATED",
      entityType: "FINANCIAL_ENTRY",
      entityId: entry.id,
      newData: {
        businessDate: input.businessDate,
        category,
        funding,
        amount: input.amount,
        paymentMethod,
        proofFileId: input.proofFileId,
      },
    },
  });

  const cashWithExpenses = await tx.employeeDailyCash.findUniqueOrThrow({
    where: { id: cash.id },
    include: cashInclude,
  });
  const expense = cashWithExpenses.expenses.find((item) => item.id === entry.id);
  if (!expense) throw new Error("O gasto foi salvo, mas não pôde ser recarregado.");
  return mapExpense(expense);
}

export async function createEmployeeExpense(
  session: SessionData,
  module: SystemModule,
  payload: unknown,
): Promise<EmployeeExpenseItem> {
  assertEmployeeCashAccess(session, module);
  const input = employeeExpenseInputSchema.parse(payload);
  await assertBusinessDayOpen(session, input.businessDate);
  return prisma.$transaction((tx) => createEmployeeExpenseInTransaction(tx, session, module, input));
}

export async function createEmployeeExpenseIdempotently(
  session: SessionData,
  module: SystemModule,
  slug: string,
  payload: unknown,
  requestKey: string,
) {
  assertEmployeeCashAccess(session, module);
  const input = employeeExpenseInputSchema.parse(payload);
  await assertBusinessDayOpen(session, input.businessDate);
  const submissionSlug = `employee-expense:${slug}`;
  const unique = {
    organizationId: session.organizationId,
    userId: session.userId,
    slug: submissionSlug,
    requestKey,
  };
  const where = { organizationId_userId_slug_requestKey: unique };
  let submission = await prisma.moduleSubmission.findUnique({ where });

  if (submission?.status === "SUCCEEDED") {
    if (submission.response) return submission.response as unknown as EmployeeExpenseItem;
    throw new EmployeeExpenseAlreadyReceivedError(
      "Este gasto já foi recebido. Atualize a tela para conferir o lançamento.",
    );
  }
  if (submission?.status === "PROCESSING") {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    const reclaimed = await prisma.moduleSubmission.updateMany({
      where: { id: submission.id, status: "PROCESSING", updatedAt: { lt: staleBefore } },
      data: { status: "PROCESSING", lastError: null },
    });
    if (reclaimed.count !== 1) {
      throw new EmployeeExpenseAlreadyReceivedError(
        "Este gasto já foi recebido e está sendo conferido.",
      );
    }
    submission = await prisma.moduleSubmission.findUniqueOrThrow({ where: { id: submission.id } });
  }
  if (submission?.status === "FAILED") {
    const failedId = submission.id;
    const reclaimed = await prisma.moduleSubmission.updateMany({
      where: { id: failedId, status: "FAILED" },
      data: { status: "PROCESSING", lastError: null },
    });
    if (reclaimed.count !== 1) {
      const concurrent = await prisma.moduleSubmission.findUnique({ where });
      if (concurrent?.status === "SUCCEEDED" && concurrent.response) {
        return concurrent.response as unknown as EmployeeExpenseItem;
      }
      throw new EmployeeExpenseAlreadyReceivedError(
        "Este gasto já foi recebido e está sendo conferido.",
      );
    }
    submission = await prisma.moduleSubmission.findUniqueOrThrow({ where: { id: failedId } });
  } else if (!submission) {
    try {
      submission = await prisma.moduleSubmission.create({
        data: { ...unique, module, status: "PROCESSING" },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const concurrent = await prisma.moduleSubmission.findUnique({ where });
      if (concurrent?.status === "SUCCEEDED" && concurrent.response) {
        return concurrent.response as unknown as EmployeeExpenseItem;
      }
      throw new EmployeeExpenseAlreadyReceivedError(
        "Este gasto já foi recebido e está sendo conferido.",
      );
    }
  }

  let result: EmployeeExpenseItem;
  try {
    // Gasto e confirmacao da chave ficam na mesma transacao. Se o processo
    // cair no meio, ambos voltam juntos e o reenvio nao duplica dinheiro.
    result = await prisma.$transaction(async (tx) => {
      const expense = await createEmployeeExpenseInTransaction(tx, session, module, input);
      await tx.moduleSubmission.update({
        where: { id: submission.id },
        data: {
          status: "SUCCEEDED",
          response: expense as unknown as Prisma.InputJsonValue,
          lastError: null,
        },
      });
      return expense;
    });
  } catch (error) {
    await prisma.moduleSubmission
      .update({
        where: { id: submission.id },
        data: {
          status: "FAILED",
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida",
        },
      })
      .catch(() => {});
    throw error;
  }
  return result;
}

export async function cancelEmployeeExpense(
  session: SessionData,
  module: SystemModule,
  entryId: string,
) {
  assertEmployeeCashAccess(session, module);
  const id = z.string().min(1).max(191).parse(entryId);
  const existing = await prisma.financialEntry.findFirst({
    where: {
      id,
      organizationId: session.organizationId,
      module,
      employeeDailyCash: {
        ...(canReviewEmployeeCash(session.role) ? {} : { employeeId: session.userId }),
        status: { in: ["OPEN", "RETURNED"] },
      },
    },
    include: { employeeDailyCash: true },
  });
  if (!existing?.employeeDailyCash) {
    throw new Error("Gasto não encontrado ou caixa já enviado.");
  }
  await assertBusinessDayOpen(session, existing.employeeDailyCash.businessDate);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.financialEntry.updateMany({
      where: {
        id,
        organizationId: session.organizationId,
        module,
        status: { not: "CANCELLED" },
        employeeDailyCash: {
          ...(canReviewEmployeeCash(session.role) ? {} : { employeeId: session.userId }),
          status: { in: ["OPEN", "RETURNED"] },
        },
      },
      data: { status: "CANCELLED", paidAmount: 0, remainingAmount: 0 },
    });
    if (updated.count !== 1) throw new Error("Este gasto já foi alterado.");
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module,
        action: "EMPLOYEE_EXPENSE_CANCELLED",
        entityType: "FINANCIAL_ENTRY",
        entityId: id,
        oldData: { status: existing.status, paidAmount: Number(existing.paidAmount) },
        newData: { status: "CANCELLED", paidAmount: 0 },
      },
    });
  });

  return getCashBoxItem(session, existing.employeeDailyCash.id);
}

export async function submitEmployeeCash(
  session: SessionData,
  module: SystemModule,
  cashId: string,
) {
  assertEmployeeCashAccess(session, module);
  const id = z.string().min(1).max(191).parse(cashId);
  const cash = await prisma.employeeDailyCash.findFirst({
    where: {
      id,
      organizationId: session.organizationId,
      module,
      employeeId: session.userId,
    },
    select: {
      id: true,
      businessDate: true,
      status: true,
      advanceAmount: true,
      _count: {
        select: {
          expenses: {
            where: {
              employeeExpenseCategory: { not: null },
              status: { not: "CANCELLED" },
            },
          },
        },
      },
    },
  });
  if (!cash) throw new Error("Caixa do funcionário não encontrado.");
  if (Number(cash.advanceAmount) === 0 && cash._count.expenses === 0) {
    throw new Error("Registre o valor recebido ou ao menos um gasto antes de enviar.");
  }
  await assertBusinessDayOpen(session, cash.businessDate);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.employeeDailyCash.updateMany({
      where: {
        id,
        organizationId: session.organizationId,
        employeeId: session.userId,
        status: { in: ["OPEN", "RETURNED"] },
      },
      data: { status: "SUBMITTED", submittedAt: new Date(), reviewedAt: null, reviewedById: null },
    });
    if (updated.count !== 1) throw new Error("Este caixa já foi enviado.");
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module,
        action: "EMPLOYEE_CASH_SUBMITTED",
        entityType: "OTHER",
        entityId: id,
        oldData: { status: cash.status },
        newData: { status: "SUBMITTED" },
      },
    });
  });
  return getCashBoxItem(session, id);
}

export async function reviewEmployeeCash(
  session: SessionData,
  module: SystemModule,
  cashId: string,
  payload: unknown,
) {
  assertEmployeeCashAccess(session, module);
  if (!canReviewEmployeeCash(session.role)) {
    throw new Error("Somente o dono pode aprovar os gastos.");
  }
  const id = z.string().min(1).max(191).parse(cashId);
  const input = reviewInputSchema.parse(payload);
  const nextStatus = input.decision === "APPROVE" ? "APPROVED" : "RETURNED";
  const existing = await prisma.employeeDailyCash.findFirst({
    where: { id, organizationId: session.organizationId, module },
    select: { id: true, businessDate: true, status: true },
  });
  if (!existing) throw new Error("Caixa do funcionário não encontrado.");
  await assertBusinessDayOpen(session, existing.businessDate);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.employeeDailyCash.updateMany({
      where: {
        id,
        organizationId: session.organizationId,
        module,
        status: "SUBMITTED",
      },
      data: {
        status: nextStatus,
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNotes: input.notes || null,
      },
    });
    if (updated.count !== 1) {
      throw new Error("Este caixa precisa estar aguardando aprovação.");
    }
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module,
        action: input.decision === "APPROVE" ? "EMPLOYEE_CASH_APPROVED" : "EMPLOYEE_CASH_RETURNED",
        entityType: "OTHER",
        entityId: id,
        oldData: { status: existing.status },
        newData: { status: nextStatus, notes: input.notes || null },
      },
    });
  });
  return getCashBoxItem(session, id);
}
