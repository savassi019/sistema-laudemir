import { CalendarRange, Download, FileText, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { requireSession } from "@/lib/auth";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getModuleReportSummary, getWeeklyFinancialSummary } from "@/server/services/module-report-service";
import { listVisitsInRange } from "@/server/services/visit-service";

export const dynamic = "force-dynamic";

export default async function RelatorioPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireSession("DASHBOARD");
  const searchParams = await props.searchParams;

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const from = searchParams.from ?? defaultFrom;
  const to = searchParams.to ?? defaultTo;

  const visits = await listVisitsInRange(session, from, to);
  const moduleRows = await getModuleReportSummary(
    session,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59`),
  );
  const moduleTotal = moduleRows.reduce((sum, row) => sum + row.total, 0);
  const weeklySummary = await getWeeklyFinancialSummary(
    session,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59`),
  );

  const totalIncome = visits.reduce((s, v) => s + v.incomeAmount, 0);
  const totalExpense = visits.reduce((s, v) => s + v.expenseAmount, 0);
  const totalNet = totalIncome - totalExpense;

  const byType = visits.reduce<Record<string, number>>((acc, v) => {
    acc[v.visitType] = (acc[v.visitType] ?? 0) + 1;
    return acc;
  }, {});

  const fromLabel = formatShortDate(from);
  const toLabel = formatShortDate(to);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[linear-gradient(135deg,rgba(17,22,20,0.92),rgba(209,160,79,0.08))] p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#9a958b]">Gestão</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Relatório de visitas
            </h1>
            <p className="mt-1 text-sm text-[#c9c2b4]">
              {fromLabel} — {toLabel} · {visits.length}{" "}
              {visits.length === 1 ? "visita" : "visitas"}
            </p>
          </div>
          <a
            href={`/api/visitas/exportar?from=${from}&to=${to}`}
            download
            className="inline-flex items-center gap-2 rounded-2xl border border-[#8aa17c]/35 bg-[#8aa17c]/12 px-4 py-3 text-sm font-semibold text-[#dbe6d4] shadow-[0_4px_14px_rgba(138,161,124,0.2)] transition hover:bg-[#8aa17c]/20"
          >
            <Download className="size-4" />
            Baixar CSV
          </a>
        </div>
      </section>

      {/* Date filter */}
      <form
        method="GET"
        action="/relatorio"
        className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4"
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
          Filtrar período
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="block text-[11px] text-[#9a958b]">De</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border border-[rgba(245,241,232,0.12)] bg-[#0b0f0e]/72 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d1a04f]/50"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="block text-[11px] text-[#9a958b]">Até</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border border-[rgba(245,241,232,0.12)] bg-[#0b0f0e]/72 px-3 py-2.5 text-sm text-white outline-none focus:border-[#d1a04f]/50"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-xl border border-[#d1a04f]/35 bg-[#d1a04f]/14 px-4 py-2.5 text-sm font-semibold text-[#f3dfae] transition hover:bg-[#d1a04f]/22"
            >
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="size-3.5 text-[#d1a04f]" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#9a958b]">Visitas</p>
          </div>
          <p className="text-2xl font-bold text-white">{visits.length}</p>
        </div>
        <div className="rounded-2xl border border-[#8aa17c]/20 bg-[#1d2e22]/60 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="size-3.5 text-[#8aa17c]" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8aa17c]/70">Entrada</p>
          </div>
          <p className="text-lg font-bold text-[#dbe6d4]">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="rounded-2xl border border-[#f87171]/15 bg-[#1a0f0f]/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingDown className="size-3.5 text-[#f87171]" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#f87171]/70">Saída</p>
          </div>
          <p className="text-lg font-bold text-[#f0c9ad]">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="rounded-2xl border border-[#d1a04f]/20 bg-[#1a1508]/60 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="size-3.5 text-[#d1a04f]" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#d1a04f]/70">Líquido</p>
          </div>
          <p className="text-lg font-bold text-[#f3dfae]">{formatCurrency(totalNet)}</p>
        </div>
      </div>

      {/* Breakdown by type */}
      {Object.keys(byType).length > 0 ? (
        <div className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
            Por tipo
          </p>
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
        </div>
      ) : null}

      {/* Module summary */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
            Resumo por módulo
          </p>
          {moduleRows.length > 0 ? (
            <a
              href={`/api/relatorio/modulos/exportar?from=${from}&to=${to}`}
              download
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8aa17c] hover:underline"
            >
              <Download className="size-3.5" />
              Baixar CSV
            </a>
          ) : null}
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
                className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(245,241,232,0.07)] bg-[#0b0f0e]/55 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{row.title}</p>
                  <p className="text-xs text-[#9a958b]">
                    {row.count} {row.count === 1 ? "registro" : "registros"}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold ${
                    row.total < 0 ? "text-[#f0c9ad]" : "text-[#dbe6d4]"
                  }`}
                >
                  {formatCurrency(row.total)}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d1a04f]/20 bg-[#1a1508]/60 px-3 py-3">
              <p className="text-sm font-semibold text-[#f3dfae]">Total dos módulos</p>
              <p className="text-sm font-bold text-[#f3dfae]">{formatCurrency(moduleTotal)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Weekly financial breakdown */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-3.5 text-[#d1a04f]" />
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
              Financeiro semanal (seg a sáb)
            </p>
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
      </div>

      {/* Visit list */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#9a958b]">
          Visitas{visits.length > 50 ? ` (mostrando 50 de ${visits.length})` : ""}
        </p>

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
                    {v.createdBy ? ` · ${v.createdBy}` : ""}
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
      </div>

      {visits.length > 0 ? (
        <a
          href={`/api/visitas/exportar?from=${from}&to=${to}`}
          download
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8aa17c]/25 bg-[#8aa17c]/8 py-3.5 text-sm font-semibold text-[#dbe6d4] transition hover:bg-[#8aa17c]/15"
        >
          <Download className="size-4" />
          Baixar CSV — {visits.length} {visits.length === 1 ? "visita" : "visitas"}
        </a>
      ) : null}
    </div>
  );
}
