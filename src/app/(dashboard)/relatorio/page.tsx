import { CalendarRange, Download, FileText, TrendingDown, TrendingUp, UserCheck, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getModuleReportSummary, getWeeklyFinancialSummary } from "@/server/services/module-report-service";
import { listVisitsInRange } from "@/server/services/visit-service";

export const dynamic = "force-dynamic";

export default async function RelatorioPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireSession("REPORTS");

  // Exigia so DASHBOARD, que todo funcionario recebe automaticamente na
  // criacao — entao qualquer um da equipe via entrada, saida e liquido.
  if (session.role === "STAFF") {
    redirect("/dashboard?denied=1");
  }

  const searchParams = await props.searchParams;

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const from = searchParams.from ?? defaultFrom;
  const to = searchParams.to ?? defaultTo;

  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);

  const [visits, moduleRows, weeklySummary, finEntries] = await Promise.all([
    listVisitsInRange(session, from, to),
    getModuleReportSummary(session, fromDate, toDate),
    getWeeklyFinancialSummary(session, fromDate, toDate),
    process.env.DEMO_MODE !== "false" ? Promise.resolve([]) : prisma.financialEntry.findMany({
      where: { organizationId: session.organizationId, issueDate: { gte: fromDate, lte: toDate } },
      select: { status: true, direction: true, totalAmount: true, remainingAmount: true, paidAmount: true },
    }).catch(() => [] as { status: string; direction: string; totalAmount: unknown; remainingAmount: unknown; paidAmount: unknown }[]),
  ]);

  const moduleTotal = moduleRows.reduce((sum, row) => sum + row.total, 0);
  const moduleIncomeTotal = moduleRows.reduce((sum, row) => sum + row.income, 0);
  const moduleExpenseTotal = moduleRows.reduce((sum, row) => sum + row.expense, 0);

  const totalIncome = visits.reduce((s, v) => s + v.incomeAmount, 0);
  const totalExpense = visits.reduce((s, v) => s + v.expenseAmount, 0);
  const totalNet = totalIncome - totalExpense;

  // Financial entries summary
  type FinStatus = { paid: number; pending: number; overdue: number; paidCount: number; pendingCount: number; overdueCount: number };
  const finSummary = finEntries.reduce<FinStatus>((acc, e) => {
    const amount = Number(e.totalAmount ?? 0);
    const remaining = Number(e.remainingAmount ?? 0);
    if (e.status === "PAID") { acc.paid += amount; acc.paidCount++; }
    else if (e.status === "OVERDUE") { acc.overdue += remaining; acc.overdueCount++; }
    else { acc.pending += remaining; acc.pendingCount++; }
    return acc;
  }, { paid: 0, pending: 0, overdue: 0, paidCount: 0, pendingCount: 0, overdueCount: 0 });

  // Per-staff breakdown
  const byStaff = visits.reduce<Record<string, { name: string; count: number; income: number }>>((acc, v) => {
    const key = v.assignedToName || v.createdBy || "—";
    if (!acc[key]) acc[key] = { name: key, count: 0, income: 0 };
    acc[key].count++;
    acc[key].income += v.incomeAmount - v.expenseAmount;
    return acc;
  }, {});
  const staffRows = Object.values(byStaff).sort((a, b) => b.count - a.count);

  const byType = visits.reduce<Record<string, number>>((acc, v) => {
    acc[v.visitType] = (acc[v.visitType] ?? 0) + 1;
    return acc;
  }, {});

  const fromLabel = formatShortDate(from);
  const toLabel = formatShortDate(to);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-6">
      <section className="overflow-hidden rounded-3xl border border-[rgba(245,241,232,0.1)] bg-[linear-gradient(135deg,rgba(17,22,20,0.96),rgba(209,160,79,0.09))] p-4 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#d1a04f]/25 bg-[#d1a04f]/10 text-[#f3dfae]">
              <FileText aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-[#9a958b]">Gestão</p>
              <h1 className="mt-1 text-pretty text-2xl font-semibold tracking-tight text-white md:text-3xl">Relatório de visitas</h1>
              <p className="mt-1 text-sm text-[#c9c2b4]">
                {fromLabel} — {toLabel} · {visits.length} {visits.length === 1 ? "visita" : "visitas"}
              </p>
            </div>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            {visits.length > 0 ? (
              <a href={`/api/visitas/exportar?from=${from}&to=${to}`} download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#8aa17c]/35 bg-[#8aa17c]/12 px-4 py-2.5 text-sm font-semibold text-[#dbe6d4] transition-colors hover:bg-[#8aa17c]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aa17c] active:bg-[#8aa17c]/24 motion-reduce:transition-none">
                <Download aria-hidden="true" className="size-4" /> Planilha de visitas
              </a>
            ) : null}
            {moduleRows.length > 0 ? (
              <a href={`/api/relatorio/modulos/exportar?from=${from}&to=${to}`} download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-4 py-2.5 text-sm font-semibold text-[#f3dfae] transition-colors hover:bg-[#d1a04f]/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d1a04f] active:bg-[#d1a04f]/22 motion-reduce:transition-none">
                <Download aria-hidden="true" className="size-4" /> Resumo por módulo
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Date filter */}
      <form
        method="GET"
        action="/relatorio"
        className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.12)] md:p-5"
        aria-labelledby="report-period-title"
      >
        <h2 id="report-period-title" className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
          Filtrar período
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-1.5">
            <label htmlFor="report-from" className="block text-sm font-medium text-[#c9c2b4]">Data inicial</label>
            <input
              id="report-from"
              type="date"
              name="from"
              defaultValue={from}
              autoComplete="off"
              className="min-h-11 w-full rounded-xl border border-[rgba(245,241,232,0.12)] bg-[#0b0f0e]/72 px-3 py-2.5 text-base text-white outline-none [color-scheme:dark] focus:border-[#d1a04f]/50 focus-visible:ring-2 focus-visible:ring-[#d1a04f]/30 md:text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="report-to" className="block text-sm font-medium text-[#c9c2b4]">Data final</label>
            <input
              id="report-to"
              type="date"
              name="to"
              defaultValue={to}
              autoComplete="off"
              className="min-h-11 w-full rounded-xl border border-[rgba(245,241,232,0.12)] bg-[#0b0f0e]/72 px-3 py-2.5 text-base text-white outline-none [color-scheme:dark] focus:border-[#d1a04f]/50 focus-visible:ring-2 focus-visible:ring-[#d1a04f]/30 md:text-sm"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="min-h-11 w-full rounded-xl bg-[#d1a04f] px-5 py-2.5 text-sm font-semibold text-[#0d0a05] transition-colors hover:bg-[#dfb462] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3dfae] active:bg-[#c59443] motion-reduce:transition-none lg:w-auto"
            >
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* Summary metrics */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do período">
        <div className="min-w-0 rounded-2xl border border-[rgba(245,241,232,0.1)] border-l-[3px] border-l-[#d1a04f] bg-[#111614]/85 p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="size-3.5 text-[#d1a04f]" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#9a958b]">Visitas</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-white">{visits.length}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-[#8aa17c]/20 border-l-[3px] border-l-[#4ade80] bg-[#111614]/85 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="size-3.5 text-[#8aa17c]" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8aa17c]/70">Entrada</p>
          </div>
          <p className="break-words text-lg font-bold tabular-nums text-[#dbe6d4]">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-[#f87171]/15 border-l-[3px] border-l-[#fb7185] bg-[#111614]/85 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingDown className="size-3.5 text-[#f87171]" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#f87171]/70">Saída</p>
          </div>
          <p className="break-words text-lg font-bold tabular-nums text-[#f0c9ad]">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-[#60a5fa]/20 border-l-[3px] border-l-[#60a5fa] bg-[#111614]/85 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="size-3.5 text-[#60a5fa]" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#93c5fd]/80">Líquido</p>
          </div>
          <p className="break-words text-lg font-bold tabular-nums text-[#bfdbfe]">{formatCurrency(totalNet)}</p>
        </div>
      </section>

      {/* Breakdown by type */}
      {Object.keys(byType).length > 0 ? (
        <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
            Por tipo
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <span
                  key={type}
                  className="rounded-xl border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-3 py-1.5 text-xs font-medium text-[#f3dfae]"
                >
                  {type} · {count}
                </span>
              ))}
          </div>
        </section>
      ) : null}

      {/* Module summary */}
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
            Resumo por módulo
          </h2>
        </div>

        {moduleRows.length === 0 ? (
          <p className="mt-3 py-2 text-center text-sm text-[#5a544c]">
            Nenhum lançamento de módulo neste período.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {moduleRows.map((row) => (
              <div
                key={row.slug}
                className="rounded-xl border border-[rgba(245,241,232,0.07)] bg-[#0b0f0e]/55 px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-white">{row.title}</p>
                  <p className={`shrink-0 text-sm font-semibold ${row.total < 0 ? "text-[#f0c9ad]" : "text-[#dbe6d4]"}`}>
                    {formatCurrency(row.total)}
                  </p>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <p className="text-[11px] text-[#9a958b]">{row.count} {row.count === 1 ? "registro" : "registros"}</p>
                  {row.income > 0 && (
                    <p className="text-[11px] text-[#86efac]">↑ {formatCurrency(row.income)}</p>
                  )}
                  {row.expense > 0 && (
                    <p className="text-[11px] text-[#f87171]">↓ {formatCurrency(row.expense)}</p>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d1a04f]/20 bg-[#1a1508]/60 px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-[#f3dfae]">Total dos módulos</p>
                <div className="mt-0.5 flex gap-3">
                  {moduleIncomeTotal > 0 && (
                    <p className="text-[11px] tabular-nums text-[#86efac]">↑ {formatCurrency(moduleIncomeTotal)}</p>
                  )}
                  {moduleExpenseTotal > 0 && (
                    <p className="text-[11px] tabular-nums text-[#f87171]">↓ {formatCurrency(moduleExpenseTotal)}</p>
                  )}
                </div>
              </div>
              <p className="text-sm font-bold tabular-nums text-[#f3dfae]">{formatCurrency(moduleTotal)}</p>
            </div>
          </div>
        )}
      </section>

      {/* Weekly financial breakdown */}
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarRange aria-hidden="true" className="size-3.5 text-[#d1a04f]" />
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
              Financeiro semanal (seg a sáb)
            </h2>
          </div>
          <p className="text-sm font-bold text-[#f3dfae]">
            Total: {formatCurrency(weeklySummary.totalAmount)}
          </p>
        </div>

        {weeklySummary.weeks.length === 0 ? (
          <p className="mt-3 py-2 text-center text-sm text-[#5a544c]">
            Nenhum lançamento de módulo neste período.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {weeklySummary.weeks.map((week) => (
              <div
                key={week.weekStart}
                className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(245,241,232,0.07)] bg-[#0b0f0e]/55 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{week.label}</p>
                  <p className="text-xs text-[#9a958b]">
                    {week.count} {week.count === 1 ? "lançamento" : "lançamentos"}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold ${
                    week.total < 0 ? "text-[#f0c9ad]" : "text-[#dbe6d4]"
                  }`}
                >
                  {formatCurrency(week.total)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Financial entries summary */}
      {(finSummary.paid > 0 || finSummary.pending > 0 || finSummary.overdue > 0) && (
        <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
            Lançamentos financeiros
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#86efac]/20 bg-[#0a1a0f]/60 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86efac]/70">Recebido</p>
              <p className="mt-1 break-words text-base font-bold tabular-nums text-[#86efac]">{formatCurrency(finSummary.paid)}</p>
              <p className="text-[10px] text-[#9a958b]">{finSummary.paidCount} lanç.</p>
            </div>
            <div className="rounded-xl border border-[#d1a04f]/20 bg-[#1a1508]/60 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#f3dfae]/70">Pendente</p>
              <p className="mt-1 break-words text-base font-bold tabular-nums text-[#f3dfae]">{formatCurrency(finSummary.pending)}</p>
              <p className="text-[10px] text-[#9a958b]">{finSummary.pendingCount} lanç.</p>
            </div>
            <div className="rounded-xl border border-[#f87171]/20 bg-[#1a0a0a]/60 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#f87171]/70">Atrasado</p>
              <p className="mt-1 break-words text-base font-bold tabular-nums text-[#f87171]">{formatCurrency(finSummary.overdue)}</p>
              <p className="text-[10px] text-[#9a958b]">{finSummary.overdueCount} lanç.</p>
            </div>
          </div>
        </section>
      )}

      {/* Per-staff breakdown */}
      {staffRows.length > 1 && (
        <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
          <div className="mb-3 flex items-center gap-2">
            <UserCheck aria-hidden="true" className="size-3.5 text-[#d1a04f]" />
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
              Por funcionário
            </h2>
          </div>
          <div className="space-y-2">
            {staffRows.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(245,241,232,0.07)] bg-[#0b0f0e]/55 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{s.name}</p>
                  <p className="text-xs text-[#9a958b]">{s.count} {s.count === 1 ? "visita" : "visitas"}</p>
                </div>
                <p className={`shrink-0 text-sm font-semibold ${s.income < 0 ? "text-[#f0c9ad]" : "text-[#dbe6d4]"}`}>
                  {formatCurrency(s.income)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Visit list */}
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
          Visitas{visits.length > 50 ? ` (mostrando 50 de ${visits.length})` : ""}
        </h2>

        {visits.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#5a544c]">
            Nenhuma visita neste período.
          </p>
        ) : (
          <div className="space-y-2">
            {visits.slice(0, 50).map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(245,241,232,0.07)] bg-[#0b0f0e]/55 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{v.clientName}</p>
                  <p className="text-xs text-[#9a958b]">
                    {v.visitType} · {formatShortDate(v.occurredAt)}
                    {v.assignedToName ? ` · 🧑‍🔧 ${v.assignedToName}` : v.createdBy ? ` · ${v.createdBy}` : ""}
                  </p>
                  {v.notes ? (
                    <p className="mt-0.5 truncate text-xs text-[#7e786d]">{v.notes}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-[#dbe6d4]">
                    {formatCurrency(v.incomeAmount)}
                  </p>
                  {v.expenseAmount > 0 ? (
                    <p className="text-xs text-[#f87171]">
                      -{formatCurrency(v.expenseAmount)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
