import type { SystemModule } from "@prisma/client";

import { currentBusinessDate } from "@/lib/business-date";
import { isBusinessDayLocked } from "@/lib/daily-close-calculations";
import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/types/app";

function businessDateFrom(value?: string | Date | null) {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return currentBusinessDate(value);
  return currentBusinessDate();
}

function storedBusinessDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

/**
 * Dias fechados sao imutaveis para todos, inclusive para o dono. O dono
 * precisa registrar uma reabertura com motivo antes de corrigir qualquer dado.
 */
export async function assertBusinessDayOpen(
  session: SessionData,
  value?: string | Date | null,
) {
  if (process.env.DEMO_MODE !== "false") return;

  const businessDate = businessDateFrom(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error("Data da operação inválida.");
  }

  const closed = await prisma.dailyClose.findUnique({
    where: {
      organizationId_businessDate: {
        organizationId: session.organizationId,
        businessDate: storedBusinessDate(businessDate),
      },
    },
    select: { status: true },
  });

  if (isBusinessDayLocked(session.role, closed?.status)) {
    throw new Error(
      "O caixa deste dia já foi fechado. O dono precisa reabrir o dia e informar o motivo antes de lançar ou corrigir valores.",
    );
  }
}

/** Confere o dia original de um lancamento antes de edita-lo ou cancela-lo. */
export async function assertFinancialEntryDayOpen(
  session: SessionData,
  module: SystemModule,
  entryId: string,
) {
  const entry = await prisma.financialEntry.findFirst({
    where: {
      id: entryId,
      organizationId: session.organizationId,
      module,
    },
    select: { issueDate: true },
  });

  if (!entry) throw new Error("Lancamento nao encontrado.");
  await assertBusinessDayOpen(session, entry.issueDate);
}
