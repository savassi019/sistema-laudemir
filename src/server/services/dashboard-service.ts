import { demoDashboard } from "@/data/demo";
import { env } from "@/lib/env";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { ChartPoint, DashboardOverview, ReminderItem, SessionData } from "@/types/app";

const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

async function buildRealCashflow(organizationId: string): Promise<ChartPoint[]> {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const entries = await prisma.financialEntry.findMany({
    where: { organizationId, createdAt: { gte: sixMonthsAgo } },
    select: { direction: true, paidAmount: true, totalAmount: true, createdAt: true },
  });

  const points: ChartPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({ label: PT_MONTHS[d.getMonth()], receitas: 0, despesas: 0 });
  }

  for (const entry of entries) {
    const d = entry.createdAt;
    const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsDiff < 0 || monthsDiff > 5) continue;
    const idx = 5 - monthsDiff;
    const amount = Number(entry.paidAmount) > 0 ? Number(entry.paidAmount) : Number(entry.totalAmount);
    if (entry.direction === "INCOME") points[idx].receitas += amount;
    else points[idx].despesas += amount;
  }

  return points;
}

async function buildRealReminders(organizationId: string): Promise<ReminderItem[]> {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 86_400_000);

  const [overdueEntries, upcomingEntries] = await Promise.all([
    prisma.financialEntry.findMany({
      where: { organizationId, status: "OVERDUE" },
      take: 3,
      orderBy: { dueDate: "asc" },
      include: { client: true },
    }),
    prisma.financialEntry.findMany({
      where: { organizationId, status: "PENDING", dueDate: { lte: nextWeek, gte: now } },
      take: 3,
      orderBy: { dueDate: "asc" },
      include: { client: true },
    }),
  ]);

  const reminders: ReminderItem[] = [];

  for (const e of overdueEntries) {
    reminders.push({
      id: e.id,
      title: `Cobrança atrasada: ${e.description}${e.client ? ` — ${e.client.name}` : ""}`,
      dueAt: e.dueDate?.toISOString() ?? e.createdAt.toISOString(),
      owner: "Financeiro",
      status: "aberto",
    });
  }

  for (const e of upcomingEntries) {
    reminders.push({
      id: `${e.id}_upcoming`,
      title: `Vence em breve: ${e.description}${e.client ? ` — ${e.client.name}` : ""}`,
      dueAt: e.dueDate?.toISOString() ?? e.createdAt.toISOString(),
      owner: "Financeiro",
      status: "aberto",
    });
  }

  return reminders;
}

const globalForReminders = globalThis as unknown as {
  completedReminders?: Map<string, Set<string>>;
};
const completedReminders =
  globalForReminders.completedReminders ?? new Map<string, Set<string>>();
globalForReminders.completedReminders = completedReminders;

export async function markReminderDone(
  session: SessionData,
  reminderId: string,
): Promise<void> {
  if (process.env.DEMO_MODE !== "false") {
    const set = completedReminders.get(session.organizationId) ?? new Set<string>();
    set.add(reminderId);
    completedReminders.set(session.organizationId, set);
    return;
  }
  // DB: no reminder table yet — ignore
}

export async function getDashboardOverview(session: SessionData): Promise<DashboardOverview> {
  if (env.demoMode) {
    const completed = completedReminders.get(session.organizationId) ?? new Set<string>();
    return {
      ...demoDashboard,
      reminders: demoDashboard.reminders.map((r) => ({
        ...r,
        status: completed.has(r.id) ? ("feito" as const) : r.status,
      })),
    };
  }

  try {
    const organizationId = session.organizationId;

    const [clientsCount, delinquentCount, incomeAgg, expenseAgg, pendingAgg, cashflow, reminders] = await Promise.all([
      prisma.client.count({ where: { organizationId } }),
      prisma.client.count({ where: { organizationId, status: "DELINQUENT" } }),
      prisma.financialEntry.aggregate({ where: { organizationId, direction: "INCOME" }, _sum: { paidAmount: true, totalAmount: true } }),
      prisma.financialEntry.aggregate({ where: { organizationId, direction: "EXPENSE" }, _sum: { paidAmount: true, totalAmount: true } }),
      prisma.financialEntry.aggregate({ where: { organizationId, status: { in: ["PENDING", "OVERDUE"] } }, _sum: { remainingAmount: true } }),
      buildRealCashflow(organizationId),
      buildRealReminders(organizationId),
    ]);

    const income = Number(incomeAgg._sum.paidAmount ?? incomeAgg._sum.totalAmount ?? 0);
    const expense = Number(expenseAgg._sum.paidAmount ?? expenseAgg._sum.totalAmount ?? 0);
    const pending = Number(pendingAgg._sum.remainingAmount ?? 0);

    return {
      metrics: [
        {
          label: "Receita recebida",
          value: formatCurrency(income),
          helper: "Total recebido de entradas",
          tone: "emerald",
        },
        {
          label: "Pendências abertas",
          value: formatCurrency(pending),
          helper: "Saldo ainda não liquidado",
          tone: "amber",
        },
        {
          label: "Clientes cadastrados",
          value: String(clientsCount),
          helper: `${delinquentCount} marcados como inadimplentes`,
          tone: "rose",
        },
        {
          label: "Lucro líquido",
          value: formatCurrency(income - expense),
          helper: "Receita menos despesas",
          tone: "sky",
        },
      ],
      cashflow,
      reminders,
      spotlights: demoDashboard.spotlights,
    };
  } catch (error) {
    console.error("[dashboard-service] getDashboardOverview falhou, retornando dados demo:", error);
    return demoDashboard;
  }
}
