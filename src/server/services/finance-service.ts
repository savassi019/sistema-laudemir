import type { FinancialKind, PaymentMethod, Prisma, SystemModule } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";

import { demoFinance } from "@/data/demo";
import { canViewCalculatedFinancials } from "@/lib/access-policy";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  DIRECTION_LABEL,
  FINANCIAL_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  rotuloDeStatus,
} from "@/lib/status-labels";
import { listModuleRecords, type ModuleSlug } from "@/server/services/module-record-service";
import type { FinanceEntryListItem, FinanceOverview, SessionData } from "@/types/app";

const paymentMethodMap: Record<string, PaymentMethod> = {
  PIX: "PIX",
  DINHEIRO: "CASH",
  CARTAO: "CREDIT_CARD",
  ABERTO: "OTHER",
  CASH: "CASH",
  CREDIT_CARD: "CREDIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  BANK_TRANSFER: "BANK_TRANSFER",
  BOLETO: "BOLETO",
  CHECK: "CHECK",
  OTHER: "OTHER",
};

const createFinancialEntrySchema = z.object({
  clientId: z.string(),
  clientName: z.string().optional(),
  description: z.string().min(2, "Informe a descricao."),
  totalAmount: z.coerce.number().min(0.01, "Informe o valor."),
  dueDate: z.string().optional(),
  kind: z.enum(["RECEIVABLE", "PAYABLE"]),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

const createModuleFinancialEntrySchema = z
  .object({
    description: z.string().min(2, "Informe a descricao."),
    totalAmount: z.coerce.number().min(0.01, "Informe o valor."),
    paidAmount: z.coerce.number().min(0).optional(),
    direction: z.enum(["INCOME", "EXPENSE"]),
    status: z.enum(["PENDING", "PARTIAL", "PAID"]),
    paymentMethod: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const paidAmount = data.paidAmount ?? 0;
    if (data.status === "PARTIAL" && (paidAmount <= 0 || paidAmount >= data.totalAmount)) {
      ctx.addIssue({
        code: "custom",
        path: ["paidAmount"],
        message: "O valor parcial deve ser maior que zero e menor que o valor total.",
      });
    }
    if ((data.status === "PARTIAL" || data.status === "PAID") && !data.paymentMethod) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethod"],
        message: "Informe a forma de pagamento.",
      });
    }
  });

const registerModulePaymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "Informe o valor pago."),
  paymentMethod: z.string().min(1, "Informe a forma de pagamento."),
  notes: z.string().optional(),
});

const updateModuleFinancialEntrySchema = z.object({
  description: z.string().min(2, "Informe a descricao."),
  totalAmount: z.coerce.number().min(0.01, "Informe o valor."),
  paymentMethod: z.string().nullish(),
  notes: z.string().nullish(),
});

const financialEntryInclude = {
  payments: {
    include: { createdBy: { select: { name: true } } },
    orderBy: { paymentDate: "desc" },
  },
} satisfies Prisma.FinancialEntryInclude;

type FinancialEntryWithPayments = Prisma.FinancialEntryGetPayload<{
  include: typeof financialEntryInclude;
}>;

export type ModuleFinancialStatus =
  | "DRAFT"
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type ModuleFinancialPaymentItem = {
  id: string;
  amount: number;
  paymentDate: string;
  method: string;
  notes: string | null;
  proofFileId: string | null;
  createdByName: string;
};

export type ModuleFinancialEntryItem = {
  id: string;
  description: string;
  direction: "INCOME" | "EXPENSE";
  status: ModuleFinancialStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: string | null;
  origin: "MANUAL" | "OPERATION";
  category: string;
  categoryLabel: string;
  clientName: string | null;
  operatorName: string | null;
  sourceEntityId: string | null;
  details: string[];
  notes: string | null;
  dueDate: string | null;
  payments: ModuleFinancialPaymentItem[];
  createdAt: string;
};

export type ModuleFinancialAuditItem = {
  id: string;
  action: string;
  actionLabel: string;
  entityId: string;
  userName: string;
  changes: string[];
  createdAt: string;
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  FINANCIAL_ENTRY_CREATED: "Lançamento criado",
  FINANCIAL_PAYMENT_REGISTERED: "Pagamento registrado",
  FINANCIAL_ENTRY_UPDATED: "Lançamento corrigido",
  FINANCIAL_ENTRY_CANCELLED: "Lançamento estornado",
  FINANCIAL_STATUS_PENDING: "Marcado como pendente",
};

function asAuditData(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function auditMoney(value: unknown) {
  return typeof value === "number" ? formatCurrency(value) : null;
}

function auditStatus(value: unknown) {
  return typeof value === "string"
    ? rotuloDeStatus(value, FINANCIAL_STATUS_LABEL)
    : null;
}

function buildAuditChanges(
  action: string,
  oldValue: Prisma.JsonValue | null,
  newValue: Prisma.JsonValue | null,
) {
  const before = asAuditData(oldValue);
  const after = asAuditData(newValue);
  const changes: string[] = [];

  if (action === "FINANCIAL_ENTRY_CREATED") {
    if (typeof after.description === "string") changes.push(`Descrição: ${after.description}`);
    if (typeof after.direction === "string") {
      changes.push(`Tipo: ${rotuloDeStatus(after.direction, DIRECTION_LABEL)}`);
    }
    const total = auditMoney(after.totalAmount);
    if (total) changes.push(`Valor: ${total}`);
    const status = auditStatus(after.status);
    if (status) changes.push(`Situação: ${status}`);
    return changes;
  }

  if (action === "FINANCIAL_PAYMENT_REGISTERED") {
    const amount = auditMoney(after.amount);
    if (amount) changes.push(`Pagamento: ${amount}`);
    const oldRemaining = auditMoney(before.remainingAmount);
    const newRemaining = auditMoney(after.remainingAmount);
    if (oldRemaining && newRemaining) changes.push(`Saldo: ${oldRemaining} → ${newRemaining}`);
    if (typeof after.method === "string") {
      changes.push(`Forma: ${rotuloDeStatus(after.method, PAYMENT_METHOD_LABEL)}`);
    }
    return changes;
  }

  if (before.description !== after.description && typeof after.description === "string") {
    changes.push(`Descrição: ${String(before.description ?? "-")} → ${after.description}`);
  }
  const oldTotal = auditMoney(before.totalAmount);
  const newTotal = auditMoney(after.totalAmount);
  if (oldTotal && newTotal && oldTotal !== newTotal) changes.push(`Valor: ${oldTotal} → ${newTotal}`);
  const oldStatus = auditStatus(before.status);
  const newStatus = auditStatus(after.status);
  if (oldStatus && newStatus && oldStatus !== newStatus) {
    changes.push(`Situação: ${oldStatus} → ${newStatus}`);
  }
  return changes.length > 0 ? changes : ["Alteração registrada com histórico preservado."];
}

export async function listModuleFinancialAudit(
  session: SessionData,
  module: SystemModule,
  take = 50,
): Promise<ModuleFinancialAuditItem[]> {
  assertModuleFinancialAccess(session);
  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: session.organizationId,
      module,
      action: { startsWith: "FINANCIAL_" },
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 100),
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    actionLabel: AUDIT_ACTION_LABEL[log.action] ?? "Alteração financeira",
    entityId: log.entityId,
    userName: log.user?.name ?? "Sistema",
    changes: buildAuditChanges(log.action, log.oldData, log.newData),
    createdAt: log.createdAt.toISOString(),
  }));
}

function assertModuleFinancialAccess(session: SessionData) {
  if (!canViewCalculatedFinancials(session.role)) {
    throw new Error("Sem permissao para acessar valores financeiros.");
  }
}

function mapManualFinancialEntry(
  entry: FinancialEntryWithPayments,
  operatorName: string | null,
): ModuleFinancialEntryItem {
  return {
    id: entry.id,
    description: entry.description,
    direction: entry.direction,
    status: entry.status as ModuleFinancialStatus,
    totalAmount: Number(entry.totalAmount),
    paidAmount: Number(entry.paidAmount),
    remainingAmount: Number(entry.remainingAmount),
    paymentMethod: entry.paymentMethod,
    origin: "MANUAL",
    category: entry.direction === "INCOME" ? "MANUAL_INCOME" : "MANUAL_EXPENSE",
    categoryLabel: entry.direction === "INCOME" ? "Entrada avulsa" : "Despesa avulsa",
    clientName: null,
    operatorName,
    sourceEntityId: null,
    details: [],
    notes: entry.notes,
    dueDate: entry.dueDate?.toISOString() ?? null,
    payments: entry.payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentDate: payment.paymentDate.toISOString(),
      method: payment.method,
      notes: payment.notes,
      proofFileId: payment.proofFileId,
      createdByName: payment.createdBy?.name ?? "-",
    })),
    createdAt: entry.createdAt.toISOString(),
  };
}

async function getManualFinancialEntryItem(
  session: SessionData,
  id: string,
): Promise<ModuleFinancialEntryItem> {
  const entry = await prisma.financialEntry.findFirstOrThrow({
    where: { id, organizationId: session.organizationId },
    include: financialEntryInclude,
  });
  const operator = entry.createdById
    ? await prisma.user.findUnique({ where: { id: entry.createdById }, select: { name: true } })
    : null;
  return mapManualFinancialEntry(entry, operator?.name ?? null);
}

export async function listModuleFinancialEntries(
  session: SessionData,
  module: SystemModule,
  slug: ModuleSlug | null = null,
  range?: { from?: Date; to?: Date },
): Promise<ModuleFinancialEntryItem[]> {
  assertModuleFinancialAccess(session);
  const dateWhere =
    range?.from || range?.to
      ? {
          createdAt: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {};

  const [entries, records] = await Promise.all([
    prisma.financialEntry.findMany({
      where: { organizationId: session.organizationId, module, ...dateWhere },
      include: financialEntryInclude,
      orderBy: { createdAt: "desc" },
    }),
    slug ? listModuleRecords(session, slug, 5000, range) : Promise.resolve([]),
  ]);

  const creatorIds = [...new Set(entries.map((entry) => entry.createdById).filter(Boolean))] as string[];
  const creators = creatorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: creatorIds }, organizationId: session.organizationId },
        select: { id: true, name: true },
      })
    : [];
  const creatorNames = new Map(creators.map((creator) => [creator.id, creator.name]));

  const avulsos = entries.map((entry) =>
    mapManualFinancialEntry(
      entry,
      entry.createdById ? (creatorNames.get(entry.createdById) ?? "-") : null,
    ),
  );

  // Operacao real do modulo (fechamento de maquina, visita etc) entra aqui
  // tambem -- senao "Financeiro" so mostra lancamento avulso digitado a
  // mao, e o dinheiro de verdade (que ja vive na tabela propria do
  // modulo) fica invisivel nessa aba. Mesma fonte que o Relatorio usa,
  // nunca duplica. Quando o modulo fornece a quebra financeira, preservamos
  // premio, desconto e demais categorias como linhas da mesma operacao.
  const operacionais: ModuleFinancialEntryItem[] = records.flatMap((r) => {
    const operatorName =
      r.operatorName ??
      (r.summary.startsWith("Funcionário: ") ? r.summary.slice("Funcionário: ".length) : null);
    const breakdown =
      r.financialBreakdown && r.financialBreakdown.length > 0
        ? r.financialBreakdown
        : [
            ...((r.incomeValue ?? 0) > 0
              ? [
                  {
                    direction: "INCOME" as const,
                    category: "OPERATION_INCOME",
                    categoryLabel: "Entrada da operação",
                    amount: r.incomeValue!,
                  },
                ]
              : []),
            ...((r.expenseValue ?? 0) > 0
              ? [
                  {
                    direction: "EXPENSE" as const,
                    category: "OPERATING_EXPENSE",
                    categoryLabel: "Despesa da operação",
                    amount: r.expenseValue!,
                  },
                ]
              : []),
          ];

    return breakdown
      .filter((part) => part.amount > 0)
      .map((part, index) => {
        const status = part.status ?? "PAID";
        return {
          id: `${r.id}-${part.category.toLowerCase()}-${index}`,
          description: r.title,
          direction: part.direction,
          status,
          totalAmount: part.amount,
          paidAmount: status === "PAID" ? part.amount : 0,
          remainingAmount: status === "PAID" ? 0 : part.amount,
          paymentMethod: r.paymentMethod ?? null,
          origin: "OPERATION" as const,
          category: part.category,
          categoryLabel: part.categoryLabel,
          clientName: r.title,
          operatorName,
          sourceEntityId: r.id,
          details: r.details,
          notes: null,
          dueDate: null,
          payments: [],
          createdAt: r.createdAt,
        };
      });
  });

  return [...avulsos, ...operacionais].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function updateModuleFinancialEntryStatus(
  session: SessionData,
  module: SystemModule,
  id: string,
  status: "PENDING" | "PARTIAL" | "PAID",
): Promise<ModuleFinancialEntryItem> {
  assertModuleFinancialAccess(session);
  if (status === "PARTIAL") {
    throw new Error("Informe o valor do pagamento parcial.");
  }

  const existing = await prisma.financialEntry.findFirstOrThrow({
    where: { id, organizationId: session.organizationId, module },
    select: {
      module: true,
      status: true,
      paidAmount: true,
      remainingAmount: true,
      paymentMethod: true,
    },
  });

  if (existing.status === "CANCELLED") throw new Error("Lancamento cancelado.");
  if (status === "PAID") {
    if (Number(existing.remainingAmount) <= 0) return getManualFinancialEntryItem(session, id);
    return registerModuleFinancialPayment(session, existing.module, id, {
      amount: Number(existing.remainingAmount),
      paymentMethod: existing.paymentMethod ?? "OTHER",
    });
  }
  if (Number(existing.paidAmount) > 0) {
    throw new Error("Um lancamento com pagamentos nao pode voltar para pendente.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.financialEntry.update({
      where: { id },
      data: { status: "PENDING", paidAt: null },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module: existing.module,
        action: "FINANCIAL_STATUS_PENDING",
        entityType: "FINANCIAL_ENTRY",
        entityId: id,
        oldData: { status: existing.status },
        newData: { status: "PENDING" },
      },
    });
  });

  return getManualFinancialEntryItem(session, id);
}

export async function createModuleFinancialEntry(
  session: SessionData,
  module: SystemModule,
  payload: Record<string, unknown>,
): Promise<ModuleFinancialEntryItem> {
  assertModuleFinancialAccess(session);
  const input = createModuleFinancialEntrySchema.parse(payload);
  const kind: FinancialKind = input.direction === "INCOME" ? "RECEIVABLE" : "PAYABLE";
  const paidAmount =
    input.status === "PAID"
      ? input.totalAmount
      : input.status === "PARTIAL"
        ? (input.paidAmount ?? 0)
        : 0;
  const paymentMethod = input.paymentMethod
    ? (paymentMethodMap[input.paymentMethod] ?? "OTHER")
    : null;

  const entryId = await prisma.$transaction(async (tx) => {
    const entry = await tx.financialEntry.create({
      data: {
        organizationId: session.organizationId,
        module,
        kind,
        direction: input.direction,
        status: input.status,
        description: input.description,
        totalAmount: input.totalAmount,
        paidAmount,
        remainingAmount: input.totalAmount - paidAmount,
        paidAt: input.status === "PAID" ? new Date() : undefined,
        paymentMethod,
        notes: input.notes,
        createdById: session.userId,
      },
    });

    if (paidAmount > 0 && paymentMethod) {
      await tx.payment.create({
        data: {
          organizationId: session.organizationId,
          financialEntryId: entry.id,
          amount: paidAmount,
          method: paymentMethod,
          notes: input.status === "PARTIAL" ? "Pagamento parcial inicial" : "Pagamento integral",
          createdById: session.userId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module,
        action: "FINANCIAL_ENTRY_CREATED",
        entityType: "FINANCIAL_ENTRY",
        entityId: entry.id,
        newData: {
          description: input.description,
          direction: input.direction,
          status: input.status,
          totalAmount: input.totalAmount,
          paidAmount,
        },
      },
    });

    return entry.id;
  });

  return getManualFinancialEntryItem(session, entryId);
}

export async function registerModuleFinancialPayment(
  session: SessionData,
  module: SystemModule,
  id: string,
  payload: Record<string, unknown>,
): Promise<ModuleFinancialEntryItem> {
  assertModuleFinancialAccess(session);
  const input = registerModulePaymentSchema.parse(payload);
  const amount = Math.round(input.amount * 100) / 100;
  const method = paymentMethodMap[input.paymentMethod] ?? "OTHER";

  await prisma.$transaction(async (tx) => {
    const existing = await tx.financialEntry.findFirstOrThrow({
      where: { id, organizationId: session.organizationId, module },
    });
    if (existing.status === "CANCELLED") throw new Error("Lancamento cancelado.");

    const remainingAmount = Number(existing.remainingAmount);
    if (remainingAmount <= 0) throw new Error("Este lancamento ja foi pago.");
    if (amount > remainingAmount) throw new Error("O pagamento supera o saldo restante.");

    const paidAmount = Math.round((Number(existing.paidAmount) + amount) * 100) / 100;
    const remaining = Math.round((remainingAmount - amount) * 100) / 100;
    const status = remaining === 0 ? "PAID" : "PARTIAL";
    const payment = await tx.payment.create({
      data: {
        organizationId: session.organizationId,
        financialEntryId: id,
        amount,
        method,
        notes: input.notes,
        createdById: session.userId,
      },
    });

    await tx.financialEntry.update({
      where: { id },
      data: {
        status,
        paidAmount,
        remainingAmount: remaining,
        paidAt: status === "PAID" ? new Date() : null,
        paymentMethod: method,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module,
        action: "FINANCIAL_PAYMENT_REGISTERED",
        entityType: "PAYMENT",
        entityId: payment.id,
        oldData: { paidAmount: Number(existing.paidAmount), remainingAmount },
        newData: { amount, paidAmount, remainingAmount: remaining, status, method },
      },
    });
  });

  return getManualFinancialEntryItem(session, id);
}

export async function updateModuleFinancialEntry(
  session: SessionData,
  module: SystemModule,
  id: string,
  payload: Record<string, unknown>,
): Promise<ModuleFinancialEntryItem> {
  assertModuleFinancialAccess(session);
  const input = updateModuleFinancialEntrySchema.parse(payload);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.financialEntry.findFirstOrThrow({
      where: { id, organizationId: session.organizationId, module },
    });
    if (existing.status === "CANCELLED") throw new Error("Lancamento cancelado.");

    const paidAmount = Number(existing.paidAmount);
    if (input.totalAmount < paidAmount) {
      throw new Error("O valor total nao pode ser menor que o valor ja pago.");
    }
    const remainingAmount = Math.round((input.totalAmount - paidAmount) * 100) / 100;
    const status = remainingAmount === 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING";
    const paymentMethod = input.paymentMethod
      ? (paymentMethodMap[input.paymentMethod] ?? "OTHER")
      : null;

    await tx.financialEntry.update({
      where: { id },
      data: {
        description: input.description,
        totalAmount: input.totalAmount,
        remainingAmount,
        status,
        paymentMethod,
        notes: input.notes,
        paidAt: status === "PAID" ? (existing.paidAt ?? new Date()) : null,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module,
        action: "FINANCIAL_ENTRY_UPDATED",
        entityType: "FINANCIAL_ENTRY",
        entityId: id,
        oldData: {
          description: existing.description,
          totalAmount: Number(existing.totalAmount),
          status: existing.status,
        },
        newData: { ...input, remainingAmount, status },
      },
    });
  });

  return getManualFinancialEntryItem(session, id);
}

export async function cancelModuleFinancialEntry(
  session: SessionData,
  module: SystemModule,
  id: string,
): Promise<ModuleFinancialEntryItem> {
  assertModuleFinancialAccess(session);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.financialEntry.findFirstOrThrow({
      where: { id, organizationId: session.organizationId, module },
    });
    if (existing.status === "CANCELLED") return;

    await tx.financialEntry.update({
      where: { id },
      data: { status: "CANCELLED", remainingAmount: 0 },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module,
        action: "FINANCIAL_ENTRY_CANCELLED",
        entityType: "FINANCIAL_ENTRY",
        entityId: id,
        oldData: { status: existing.status },
        newData: { status: "CANCELLED" },
      },
    });
  });

  return getManualFinancialEntryItem(session, id);
}

export async function getFinanceOverview(session: SessionData): Promise<FinanceOverview> {
  if (process.env.DEMO_MODE !== "false") {
    return demoFinance;
  }

  try {
    const organizationId = session.organizationId;

    const [totalsAgg, entries] = await Promise.all([
      Promise.all([
        prisma.financialEntry.aggregate({ where: { organizationId, status: "PAID" }, _sum: { paidAmount: true, totalAmount: true } }),
        prisma.financialEntry.aggregate({ where: { organizationId, direction: "EXPENSE", status: { not: "PAID" } }, _sum: { remainingAmount: true } }),
        prisma.financialEntry.aggregate({ where: { organizationId, status: "PARTIAL" }, _sum: { remainingAmount: true } }),
        prisma.financialEntry.aggregate({ where: { organizationId, direction: "INCOME" }, _sum: { paidAmount: true, totalAmount: true } }),
        prisma.financialEntry.aggregate({ where: { organizationId, direction: "EXPENSE" }, _sum: { paidAmount: true, totalAmount: true } }),
      ]),
      prisma.financialEntry.findMany({
        where: { organizationId },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
        include: { client: true },
      }),
    ]);

    const [paidAgg, payablesAgg, partialAgg, incomeAgg, expenseAgg] = totalsAgg;

    const incomeReceived = Number(paidAgg._sum.paidAmount ?? paidAgg._sum.totalAmount ?? 0);
    const incomePaid = Number(incomeAgg._sum.paidAmount ?? incomeAgg._sum.totalAmount ?? 0);
    const expensePaid = Number(expenseAgg._sum.paidAmount ?? expenseAgg._sum.totalAmount ?? 0);

    const totals = {
      received: incomeReceived,
      payables: Number(payablesAgg._sum.remainingAmount ?? 0),
      partial: Number(partialAgg._sum.remainingAmount ?? 0),
      net: incomePaid - expensePaid,
    };

    return {
      cards: [
        {
          label: "Total recebido",
          value: formatCurrency(totals.received),
          helper: "Baixas confirmadas",
          tone: "emerald",
        },
        {
          label: "Contas a pagar",
          value: formatCurrency(totals.payables),
          helper: "Pendencias de saida",
          tone: "amber",
        },
        {
          label: "Parciais em aberto",
          value: formatCurrency(totals.partial),
          helper: "Lancamentos com baixa parcial",
          tone: "rose",
        },
        {
          label: "Saldo liquido",
          value: formatCurrency(totals.net),
          helper: "Resultado do conjunto filtrado",
          tone: "sky",
        },
      ],
      entries: entries.map((entry) => ({
        id: entry.id,
        reference: entry.referenceCode ?? entry.id.slice(0, 8).toUpperCase(),
        description: entry.description,
        module: entry.module,
        status:
          entry.status === "PAID"
            ? "pago"
            : entry.status === "PARTIAL"
              ? "parcial"
              : entry.status === "OVERDUE"
                ? "atrasado"
                : "pendente",
        amount: Number(entry.totalAmount),
        paid: Number(entry.paidAmount),
        remaining: Number(entry.remainingAmount),
        dueDate: entry.dueDate?.toISOString() ?? entry.createdAt.toISOString(),
        method: entry.paymentMethod ?? "Nao informado",
        customer: entry.client?.name,
      })),
    };
  } catch (error) {
    console.error("[finance-service] getFinanceOverview falhou, retornando dados demo:", error);
    return demoFinance;
  }
}

export async function createFinancialEntry(
  session: SessionData,
  payload: Record<string, unknown>,
): Promise<FinanceEntryListItem> {
  const input = createFinancialEntrySchema.parse(payload);
  const direction = input.kind === "RECEIVABLE" ? "INCOME" : "EXPENSE";
  const id = randomUUID();
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;

  const entry: FinanceEntryListItem = {
    id,
    reference: id.slice(0, 8).toUpperCase(),
    description: input.description,
    module: "CLIENTS",
    status: "pendente",
    amount: input.totalAmount,
    paid: 0,
    remaining: input.totalAmount,
    dueDate: (dueDate ?? new Date()).toISOString(),
    method: input.paymentMethod ?? "Nao informado",
    customer: input.clientName,
  };

  if (process.env.DEMO_MODE !== "false") {
    return entry;
  }

  try {
    await prisma.financialEntry.create({
      data: {
        id,
        organizationId: session.organizationId,
        clientId: input.clientId,
        module: "CLIENTS",
        kind: input.kind as FinancialKind,
        direction,
        status: "PENDING",
        description: input.description,
        dueDate: dueDate ?? undefined,
        totalAmount: input.totalAmount,
        remainingAmount: input.totalAmount,
        paymentMethod: input.paymentMethod ? paymentMethodMap[input.paymentMethod] ?? "OTHER" : undefined,
        notes: input.notes,
        createdById: session.userId,
      },
    });
  } catch (error) {
    console.error("[finance-service] createFinancialEntry falhou, mantendo apenas em memoria local:", error);
  }

  return entry;
}
