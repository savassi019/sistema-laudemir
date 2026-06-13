import { Prisma } from "@prisma/client";

import { demoFinance } from "@/data/demo";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { FinanceOverview } from "@/types/app";

export async function getFinanceOverview(): Promise<FinanceOverview> {
  if (process.env.DEMO_MODE !== "false") {
    return demoFinance;
  }

  try {
    const entries = await prisma.financialEntry.findMany({
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 20,
      include: {
        client: true,
      },
    });

    const totals = entries.reduce(
      (acc, entry) => {
        const total = Number(entry.totalAmount);
        const paid = Number(entry.paidAmount);
        const remaining = Number(entry.remainingAmount);

        if (entry.status === "PAID") {
          acc.received += paid || total;
        }

        if (entry.direction === "EXPENSE" && entry.status !== "PAID") {
          acc.payables += remaining;
        }

        if (entry.status === "PARTIAL") {
          acc.partial += remaining;
        }

        acc.net += entry.direction === "INCOME" ? paid || total : -(paid || total);
        return acc;
      },
      { received: 0, payables: 0, partial: 0, net: 0 },
    );

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
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return demoFinance;
    }

    return demoFinance;
  }
}
