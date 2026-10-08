import { z } from "zod";

import { currentBusinessDate } from "@/lib/business-date";
import {
  isBusinessDayLocked,
  summarizeDailyMovements,
  type DailyCloseTotals,
} from "@/lib/daily-close-calculations";
import { getModuleBySlug } from "@/lib/module-catalog";
import { prisma } from "@/lib/prisma";
import { listModuleFinancialEntries } from "@/server/services/finance-service";
import { moduleSlugs } from "@/server/services/module-record-service";
import type { SessionData } from "@/types/app";

const closeInputSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  countedCash: z.coerce.number().min(0),
  countedPix: z.coerce.number().min(0),
  countedCard: z.coerce.number().min(0),
  countedOther: z.coerce.number().min(0),
  notes: z.string().trim().max(1000).optional(),
});

const reopenInputSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(5, "Informe o motivo da reabertura.").max(1000),
});

export type { DailyCloseTotals } from "@/lib/daily-close-calculations";

export type DailyCloseView = DailyCloseTotals & {
  id: string;
  businessDate: string;
  status: "CLOSED" | "REOPENED";
  countedCash: number;
  countedPix: number;
  countedCard: number;
  countedOther: number;
  differenceAmount: number;
  notes: string | null;
  closedAt: string;
  closedBy: string;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
};

export type DailyCloseSnapshot = DailyCloseTotals & {
  businessDate: string;
  closed: DailyCloseView | null;
};

function assertOwner(session: SessionData) {
  if (session.role !== "OWNER") {
    throw new Error("Somente o dono pode conferir e fechar o dia.");
  }
}

function businessDateRange(date: string) {
  return {
    from: new Date(`${date}T00:00:00-03:00`),
    to: new Date(`${date}T23:59:59.999-03:00`),
    storedDate: new Date(`${date}T12:00:00Z`),
  };
}

function asMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function mapClose(row: {
  id: string;
  businessDate: Date;
  status: "CLOSED" | "REOPENED";
  expectedCash: unknown;
  expectedPix: unknown;
  expectedCard: unknown;
  expectedOther: unknown;
  expectedIncome: unknown;
  expectedExpense: unknown;
  expectedPrize: unknown;
  expectedNet: unknown;
  countedCash: unknown;
  countedPix: unknown;
  countedCard: unknown;
  countedOther: unknown;
  differenceAmount: unknown;
  notes: string | null;
  closedAt: Date;
  reopenedAt: Date | null;
  reopenReason: string | null;
  createdBy: { name: string } | null;
  reopenedBy: { name: string } | null;
}): DailyCloseView {
  return {
    id: row.id,
    businessDate: row.businessDate.toISOString().slice(0, 10),
    status: row.status,
    expectedCash: asMoney(row.expectedCash),
    expectedPix: asMoney(row.expectedPix),
    expectedCard: asMoney(row.expectedCard),
    expectedOther: asMoney(row.expectedOther),
    expectedIncome: asMoney(row.expectedIncome),
    expectedExpense: asMoney(row.expectedExpense),
    expectedPrize: asMoney(row.expectedPrize),
    expectedNet: asMoney(row.expectedNet),
    countedCash: asMoney(row.countedCash),
    countedPix: asMoney(row.countedPix),
    countedCard: asMoney(row.countedCard),
    countedOther: asMoney(row.countedOther),
    differenceAmount: asMoney(row.differenceAmount),
    notes: row.notes,
    closedAt: row.closedAt.toISOString(),
    closedBy: row.createdBy?.name ?? "Dono",
    reopenedAt: row.reopenedAt?.toISOString() ?? null,
    reopenedBy: row.reopenedBy?.name ?? null,
    reopenReason: row.reopenReason,
  };
}

async function calculateTotals(session: SessionData, businessDate: string): Promise<DailyCloseTotals> {
  const { from, to } = businessDateRange(businessDate);
  const moduleEntries = await Promise.all(
    moduleSlugs.map(async (slug) => {
      const item = getModuleBySlug(slug);
      if (!item) return [];
      const entries = await listModuleFinancialEntries(session, item.module, slug, { from, to });
      return entries.filter((entry) => entry.origin === "OPERATION");
    }),
  );

  const payments = await prisma.payment.findMany({
    where: {
      organizationId: session.organizationId,
      paymentDate: { gte: from, lte: to },
    },
    include: {
      financialEntry: { select: { direction: true, status: true } },
    },
  });

  return summarizeDailyMovements(
    moduleEntries.flat(),
    payments.map((payment) => ({
      amount: Number(payment.amount),
      method: payment.method,
      direction: payment.financialEntry.direction,
      entryStatus: payment.financialEntry.status,
    })),
  );
}

export async function getDailyCloseSnapshot(
  session: SessionData,
  businessDate = currentBusinessDate(),
): Promise<DailyCloseSnapshot> {
  assertOwner(session);
  closeInputSchema.shape.businessDate.parse(businessDate);
  const { storedDate } = businessDateRange(businessDate);
  const [totals, closed] = await Promise.all([
    calculateTotals(session, businessDate),
    prisma.dailyClose.findUnique({
      where: {
        organizationId_businessDate: {
          organizationId: session.organizationId,
          businessDate: storedDate,
        },
      },
      include: {
        createdBy: { select: { name: true } },
        reopenedBy: { select: { name: true } },
      },
    }),
  ]);

  return {
    businessDate,
    ...totals,
    closed: closed ? mapClose(closed) : null,
  };
}

export async function closeBusinessDay(session: SessionData, payload: unknown) {
  assertOwner(session);
  const input = closeInputSchema.parse(payload);
  const totals = await calculateTotals(session, input.businessDate);
  const { storedDate } = businessDateRange(input.businessDate);
  const countedTotal = input.countedCash + input.countedPix + input.countedCard + input.countedOther;
  const differenceAmount = countedTotal - totals.expectedIncome;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.dailyClose.findUnique({
      where: {
        organizationId_businessDate: {
          organizationId: session.organizationId,
          businessDate: storedDate,
        },
      },
    });
    if (existing?.status === "CLOSED") {
      throw new Error("Este dia já está fechado. Reabra antes de fazer outra conferência.");
    }

    const data = {
      status: "CLOSED" as const,
      expectedCash: totals.expectedCash,
      expectedPix: totals.expectedPix,
      expectedCard: totals.expectedCard,
      expectedOther: totals.expectedOther,
      expectedIncome: totals.expectedIncome,
      expectedExpense: totals.expectedExpense,
      expectedPrize: totals.expectedPrize,
      expectedNet: totals.expectedNet,
      countedCash: input.countedCash,
      countedPix: input.countedPix,
      countedCard: input.countedCard,
      countedOther: input.countedOther,
      differenceAmount,
      notes: input.notes || null,
      createdById: session.userId,
      closedAt: new Date(),
      reopenedById: null,
      reopenedAt: null,
      reopenReason: null,
    };

    const close = existing
      ? await tx.dailyClose.update({ where: { id: existing.id }, data })
      : await tx.dailyClose.create({
          data: {
            organizationId: session.organizationId,
            businessDate: storedDate,
            ...data,
          },
        });

    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module: "FINANCE",
        action: "DAILY_CLOSE_COMPLETED",
        entityType: "OTHER",
        entityId: close.id,
        oldData: existing ? { status: existing.status } : undefined,
        newData: { businessDate: input.businessDate, ...totals, countedTotal, differenceAmount },
      },
    });
    return close;
  });

  return result.id;
}

export async function reopenBusinessDay(session: SessionData, payload: unknown) {
  assertOwner(session);
  const input = reopenInputSchema.parse(payload);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.dailyClose.findFirst({
      where: { id: input.id, organizationId: session.organizationId },
    });
    if (!existing) throw new Error("Fechamento não encontrado.");
    if (existing.status === "REOPENED") throw new Error("Este dia já está reaberto.");

    await tx.dailyClose.update({
      where: { id: existing.id },
      data: {
        status: "REOPENED",
        reopenedById: session.userId,
        reopenedAt: new Date(),
        reopenReason: input.reason,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        module: "FINANCE",
        action: "DAILY_CLOSE_REOPENED",
        entityType: "OTHER",
        entityId: existing.id,
        oldData: { status: existing.status },
        newData: { status: "REOPENED", reason: input.reason },
      },
    });
  });
}

export async function assertBusinessDayOpen(session: SessionData, value?: string | Date | null) {
  if (session.role === "OWNER") return;
  const businessDate =
    typeof value === "string"
      ? value.slice(0, 10)
      : value instanceof Date
        ? currentBusinessDate(value)
        : currentBusinessDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return;
  const { storedDate } = businessDateRange(businessDate);
  const closed = await prisma.dailyClose.findUnique({
    where: {
      organizationId_businessDate: {
        organizationId: session.organizationId,
        businessDate: storedDate,
      },
    },
    select: { status: true },
  });
  if (isBusinessDayLocked(session.role, closed?.status)) {
    throw new Error("O caixa deste dia já foi fechado pelo dono. Solicite a reabertura para lançar ou corrigir valores.");
  }
}
