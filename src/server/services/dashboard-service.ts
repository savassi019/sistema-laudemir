import { Prisma } from "@prisma/client";

import { demoDashboard } from "@/data/demo";
import { env } from "@/lib/env";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { DashboardOverview } from "@/types/app";

export async function getDashboardOverview(): Promise<DashboardOverview> {
  if (env.demoMode) {
    return demoDashboard;
  }

  try {
    const [clientsCount, delinquentCount, finance] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { status: "DELINQUENT" } }),
      prisma.financialEntry.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const totals = finance.reduce(
      (acc, entry) => {
        const total = Number(entry.totalAmount);
        const paid = Number(entry.paidAmount);
        const remaining = Number(entry.remainingAmount);

        if (entry.direction === "INCOME") {
          acc.income += paid > 0 ? paid : total;
        } else {
          acc.expense += paid > 0 ? paid : total;
        }

        if (entry.status === "PENDING" || entry.status === "OVERDUE") {
          acc.pending += remaining;
        }

        return acc;
      },
      { income: 0, expense: 0, pending: 0 },
    );

    return {
      metrics: [
        {
          label: "Receita recebida",
          value: formatCurrency(totals.income),
          helper: `${finance.length} lancamentos considerados`,
          tone: "emerald",
        },
        {
          label: "Pendencias abertas",
          value: formatCurrency(totals.pending),
          helper: "Saldo ainda nao liquidado",
          tone: "amber",
        },
        {
          label: "Clientes cadastrados",
          value: String(clientsCount),
          helper: `${delinquentCount} marcados como inadimplentes`,
          tone: "rose",
        },
        {
          label: "Lucro liquido",
          value: formatCurrency(totals.income - totals.expense),
          helper: "Receita menos despesas",
          tone: "sky",
        },
      ],
      cashflow: demoDashboard.cashflow,
      reminders: demoDashboard.reminders,
      spotlights: demoDashboard.spotlights,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return demoDashboard;
    }

    return demoDashboard;
  }
}
