"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Printer } from "lucide-react";

import { getModuleReportAction } from "@/server/actions/module-record-actions";
import { cn } from "@/lib/cn";
import type { ModuleReport } from "@/server/services/module-report-service";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildPrintHtml(
  moduleTitle: string,
  from: string,
  to: string,
  report: ModuleReport,
): string {
  const fmtP = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const cls = (v: number) => (v < 0 ? "red" : "blue");

  const monthRows = report.months
    .map(
      (m) => `
    <tr>
      <td>${m.label}</td>
      <td class="center">${m.count}</td>
      <td class="right green">${m.income > 0 ? fmtP(m.income) : "—"}</td>
      <td class="right red">${m.expense > 0 ? fmtP(m.expense) : "—"}</td>
      <td class="right ${cls(m.net)} bold">${fmtP(m.net)}</td>
    </tr>`,
    )
    .join("");

  const recordRows = report.records
    .map(
      (r) => `
    <tr>
      <td class="muted">${r.createdAt ? fmtDate(String(r.createdAt)) : "—"}</td>
      <td>${r.title}</td>
      <td class="right green">${r.incomeValue > 0 ? fmtP(r.incomeValue) : "—"}</td>
      <td class="right red">${r.expenseValue > 0 ? fmtP(r.expenseValue) : "—"}</td>
      <td class="right ${cls(r.amountValue)} bold">${fmtP(r.amountValue)}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório — ${moduleTitle}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;padding:32px;font-size:14px;line-height:1.5}
h1{font-size:22px;font-weight:700;margin-bottom:4px}
.sub{color:#666;font-size:12px;margin-bottom:24px}
.cards{display:flex;gap:14px;margin-bottom:28px;flex-wrap:wrap}
.card{flex:1;min-width:120px;border:1px solid #e5e7eb;border-radius:10px;padding:14px}
.card-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#888}
.card-value{font-size:20px;font-weight:700;margin-top:4px}
.green{color:#16a34a}.red{color:#dc2626}.blue{color:#2563eb}.muted{color:#888}
.bold{font-weight:600}
h2{font-size:15px;font-weight:600;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;margin-top:28px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#888;padding:8px 10px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
td{padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px}
.right{text-align:right}.center{text-align:center}
tr:last-child td{border-bottom:none}
@media print{body{padding:16px}}
</style>
</head>
<body>
<h1>${moduleTitle}</h1>
<p class="sub">Período: ${fmtDate(from)} a ${fmtDate(to)} &nbsp;·&nbsp; ${report.count} registro${report.count !== 1 ? "s" : ""} &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>

<div class="cards">
  <div class="card"><p class="card-label">Entradas</p><p class="card-value green">${fmtP(report.totalIncome)}</p></div>
  <div class="card"><p class="card-label">Despesas</p><p class="card-value red">${fmtP(report.totalExpense)}</p></div>
  <div class="card"><p class="card-label">Resultado</p><p class="card-value ${cls(report.totalNet)}">${fmtP(report.totalNet)}</p></div>
</div>

${
  report.months.length > 0
    ? `<h2>Por mês</h2>
<table>
  <thead><tr><th>Mês</th><th class="center">Reg.</th><th class="right">Entradas</th><th class="right">Despesas</th><th class="right">Resultado</th></tr></thead>
  <tbody>${monthRows}</tbody>
</table>`
    : ""
}

${
  report.records.length > 0
    ? `<h2>Registros</h2>
<table>
  <thead><tr><th>Data</th><th>Descrição</th><th class="right">Entrada</th><th class="right">Despesa</th><th class="right">Resultado</th></tr></thead>
  <tbody>${recordRows}</tbody>
</table>`
    : ""
}
</body>
</html>`;
}

const inputCls =
  "rounded-xl border border-[rgba(245,241,232,0.12)] bg-[#0b0f0e]/55 px-3 py-2 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-[#d1a04f]/50";

export function ModuleReportTab({
  slug,
  moduleTitle,
}: {
  slug: string;
  moduleTitle: string;
}) {
  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());
  const [report, setReport] = useState<ModuleReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getModuleReportAction(slug, from, to)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, from, to]);

  function handlePrint() {
    if (!report) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildPrintHtml(moduleTitle, from, to, report));
    win.document.close();
    win.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={inputCls}
        />
        <span className="text-xs text-[#9a958b]">até</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={inputCls}
        />
        {loading ? <LoaderCircle className="size-4 animate-spin text-[#9a958b]" /> : null}
        <button
          type="button"
          onClick={handlePrint}
          disabled={!report || loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-[rgba(245,241,232,0.12)] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#c9c2b4] transition hover:border-[rgba(245,241,232,0.22)] hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          <Printer className="size-3.5" />
          Imprimir / PDF
        </button>
      </div>

      {loading && !report ? (
        <div className="flex items-center justify-center py-10">
          <LoaderCircle className="size-6 animate-spin text-[#9a958b]" />
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <article className="overflow-hidden rounded-xl border-l-2 border-l-[#4ade80] bg-[#0b0f0e]/55 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-[#8d867a]">Entradas</p>
              <p className="mt-1 text-base font-semibold text-[#4ade80]">
                {fmt(report.totalIncome)}
              </p>
            </article>
            <article className="overflow-hidden rounded-xl border-l-2 border-l-[#f87171] bg-[#0b0f0e]/55 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-[#8d867a]">Despesas</p>
              <p className="mt-1 text-base font-semibold text-[#f87171]">
                {fmt(report.totalExpense)}
              </p>
            </article>
            <article
              className={cn(
                "overflow-hidden rounded-xl border-l-2 bg-[#0b0f0e]/55 px-3 py-2.5",
                report.totalNet < 0 ? "border-l-[#f87171]" : "border-l-[#60a5fa]",
              )}
            >
              <p className="text-[10px] uppercase tracking-widest text-[#8d867a]">Resultado</p>
              <p
                className={cn(
                  "mt-1 text-base font-semibold",
                  report.totalNet < 0 ? "text-[#f87171]" : "text-[#60a5fa]",
                )}
              >
                {fmt(report.totalNet)}
              </p>
            </article>
          </div>

          {report.months.length > 0 ? (
            <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-3">
              <h3 className="mb-3 text-sm font-semibold text-white">Por mês</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-xs">
                  <thead>
                    <tr className="border-b border-[rgba(245,241,232,0.08)]">
                      <th className="pb-2 pr-3 text-left font-medium text-[#9a958b]">Mês</th>
                      <th className="pb-2 pr-3 text-center font-medium text-[#9a958b]">Reg.</th>
                      <th className="pb-2 pr-3 text-right font-medium text-[#9a958b]">Entradas</th>
                      <th className="pb-2 pr-3 text-right font-medium text-[#9a958b]">Despesas</th>
                      <th className="pb-2 text-right font-medium text-[#9a958b]">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.months.map((m) => (
                      <tr
                        key={m.monthKey}
                        className="border-b border-[rgba(245,241,232,0.05)] last:border-b-0"
                      >
                        <td className="py-2 pr-3 capitalize text-white">{m.label}</td>
                        <td className="py-2 pr-3 text-center text-[#9a958b]">{m.count}</td>
                        <td className="py-2 pr-3 text-right text-[#4ade80]">
                          {m.income > 0 ? fmt(m.income) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right text-[#f87171]">
                          {m.expense > 0 ? fmt(m.expense) : "—"}
                        </td>
                        <td
                          className={cn(
                            "py-2 text-right font-medium",
                            m.net < 0 ? "text-[#f87171]" : "text-[#60a5fa]",
                          )}
                        >
                          {fmt(m.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {report.records.length > 0 ? (
            <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-3">
              <h3 className="mb-3 text-sm font-semibold text-white">
                Registros{" "}
                <span className="text-xs font-normal text-[#9a958b]">({report.count})</span>
              </h3>
              <div className="space-y-1.5">
                {report.records.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-[rgba(245,241,232,0.06)] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white">{r.title}</p>
                      <span className="shrink-0 text-[11px] text-[#9a958b]">
                        {r.createdAt ? fmtDate(String(r.createdAt)) : "—"}
                      </span>
                    </div>
                    {r.incomeValue > 0 || r.expenseValue > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                        {r.incomeValue > 0 ? (
                          <span className="text-[#4ade80]">↑ {fmt(r.incomeValue)}</span>
                        ) : null}
                        {r.expenseValue > 0 ? (
                          <span className="text-[#f87171]">↓ {fmt(r.expenseValue)}</span>
                        ) : null}
                        <span
                          className={cn(
                            "font-medium",
                            r.amountValue < 0 ? "text-[#f87171]" : "text-[#60a5fa]",
                          )}
                        >
                          = {fmt(r.amountValue)}
                        </span>
                      </div>
                    ) : r.amountValue !== 0 ? (
                      <p
                        className={cn(
                          "mt-1 text-xs font-medium",
                          r.amountValue < 0 ? "text-[#f87171]" : "text-[#60a5fa]",
                        )}
                      >
                        {fmt(r.amountValue)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,241,232,0.14)] bg-white/[0.02] px-4 py-8 text-center">
              <p className="text-sm text-[#9a958b]">Nenhum registro no período selecionado.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
