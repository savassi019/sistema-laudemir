import type { FinancialKind, PaymentMethod, SystemModule } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";

import { demoFinance } from "@/data/demo";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { FinanceEntryListItem, FinanceOverview, SessionData } from "@/types/app";

const paymentMethodMap: Record<string, PaymentMethod> = {
  PIX: "PIX",
  DINHEIRO: "CASH",
  CARTAO: "CREDIT_CARD",
  ABERTO: "OTHER",
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

const createModuleFinancialEntrySchema = z.object({
  description: z.string().min(2, "Informe a descricao."),
  totalAmount: z.coerce.number().min(0.01, "Informe o valor."),
  direction: z.enum(["INCOME", "EXPENSE"]),
  status: z.enum(["PENDING", "PARTIAL", "PAID"]),
  paymentMethod: z.string().optional(),
});

export type ModuleFinancialEntryItem = {
  id: string;
  description: string;
  direction: "INCOME" | "EXPENSE";
  status: "PENDING" | "PARTIAL" | "PAID";
  totalAmount: number;
  paymentMethod: string | null;
  createdAt: string;
};

export async function listModuleFinancialEntries(
  session: SessionData,
  module: SystemModule,
): Promise<ModuleFinancialEntryItem[]> {
  const entries = await prisma.financialEntry.findMany({
    where: { organizationId: session.organizationId, module },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return entries.map((entry) => ({
    id: entry.id,
    description: entry.description,
    direction: entry.direction,
    status: entry.status as "PENDING" | "PARTIAL" | "PAID",
    totalAmount: Number(entry.totalAmount),
    paymentMethod: entry.paymentMethod,
    createdAt: entry.createdAt.toISOString(),
  }));
}

export async function createModuleFinancialEntry(
  session: SessionData,
  module: SystemModule,
  payload: Record<string, unknown>,
): Promise<ModuleFinancialEntryItem> {
  const input = createModuleFinancialEntrySchema.parse(payload);
  const kind: FinancialKind = input.direction === "INCOME" ? "RECEIVABLE" : "PAYABLE";
  const paidAmount = input.status === "PAID" ? input.totalAmount : 0;

  const entry = await prisma.financialEntry.create({
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
      paymentMethod: input.paymentMethod ? paymentMethodMap[input.paymentMethod] ?? "OTHER" : undefined,
      createdById: session.userId,
    },
  });

  return {
    id: entry.id,
    description: entry.description,
    direction: entry.direction,
    status: entry.status as "PENDING" | "PARTIAL" | "PAID",
    totalAmount: Number(entry.totalAmount),
    paymentMethod: entry.paymentMethod,
    createdAt: entry.createdAt.toISOString(),
  };
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
