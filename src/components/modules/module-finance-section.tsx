"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  List,
  LoaderCircle,
  Printer,
  Plus,
  Table2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  createModuleFinancialEntryAction,
  listModuleFinancialEntriesAction,
} from "@/server/actions/finance-actions";
import type { ModuleFinancialEntryItem } from "@/server/services/finance-service";
import { fieldClass, labelClass, selectClass } from "./styles";

function getWeekMonday(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeekLabel(monday: Date): string {
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `Seg ${fmt(monday)} – Sáb ${fmt(saturday)}`;
}

function formatMonthLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function fmtPrint(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDatePrint(s: string) {
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "border-[#c9a84c]/35 bg-[#c9a84c]/10 text-[#f0d98a]",
  PARTIAL: "border-[#7b9fc9]/35 bg-[#7b9fc9]/10 text-[#b8d4f5]",
  PAID: "border-[#6b9d6f]/35 bg-[#6b9d6f]/10 text-[#bfe3c2]",
};

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  ABERTO: "Aberto",
};

type FilterKey = "todos" | "entradas" | "despesas" | "pendentes";
type ViewMode = "lista" | "semanas" | "meses";

function buildPrintHtml(
  moduleTitle: string,
  from: string,
  to: string,
  entries: ModuleFinancialEntryItem[],
  months: { monthStart: Date; income: number; expense: number; count: number }[],
): string {
  const income = entries.filter((e) => e.direction === "INCOME").reduce((s, e) => s + e.totalAmount, 0);
  const expense = entries.filter((e) => e.direction === "EXPENSE").reduce((s, e) => s + e.totalAmount, 0);
  const net = income - expense;
  const cls = (v: number) => (v < 0 ? "red" : "blue");

  const monthRows = months
    .map((m) => {
      const mNet = m.income - m.expense;
      return `
    <tr>
      <td>${formatMonthLabel(m.monthStart)}</td>
      <td class="center">${m.count}</td>
      <td class="right green">${m.income > 0 ? fmtPrint(m.income) : "—"}</td>
      <td class="right red">${m.expense > 0 ? fmtPrint(m.expense) : "—"}</td>
      <td class="right ${cls(mNet)} bold">${fmtPrint(mNet)}</td>
    </tr>`;
    })
    .join("");

  const entryRows = entries
    .map(
      (e) => `
    <tr>
      <td class="muted">${fmtDatePrint(e.createdAt)}</td>
      <td>${e.description}</td>
      <td class="right green">${e.direction === "INCOME" ? fmtPrint(e.totalAmount) : "—"}</td>
      <td class="right red">${e.direction === "EXPENSE" ? fmtPrint(e.totalAmount) : "—"}</td>
    </tr>`,
    )
    .join("");

  const periodLabel = from && to ? `Período: ${fmtDatePrint(from)} a ${fmtDatePrint(to)} &nbsp;·&nbsp; ` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Financeiro — ${moduleTitle}</title>
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
<h1>${moduleTitle} — Financeiro</h1>
<p class="sub">${periodLabel}${entries.length} lançamento${entries.length !== 1 ? "s" : ""} &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>

<div class="cards">
  <div class="card"><p class="card-label">Entradas</p><p class="card-value green">${fmtPrint(income)}</p></div>
  <div class="card"><p class="card-label">Despesas</p><p class="card-value red">${fmtPrint(expense)}</p></div>
  <div class="card"><p class="card-label">Saldo</p><p class="card-value ${cls(net)}">${fmtPrint(net)}</p></div>
</div>

${
  months.length > 0
    ? `<h2>Por mês</h2>
<table>
  <thead><tr><th>Mês</th><th class="center">Reg.</th><th class="right">Entradas</th><th class="right">Despesas</th><th class="right">Resultado</th></tr></thead>
  <tbody>${monthRows}</tbody>
</table>`
    : ""
}

${
  entries.length > 0
    ? `<h2>Lançamentos</h2>
<table>
  <thead><tr><th>Data</th><th>Descrição</th><th class="right">Entrada</th><th class="right">Despesa</th></tr></thead>
  <tbody>${entryRows}</tbody>
</table>`
    : ""
}
</body>
</html>`;
}

export function ModuleFinanceSection({
  slug,
  moduleTitle,
  initialEntries,
}: {
  slug: string;
  moduleTitle: string;
  initialEntries: ModuleFinancialEntryItem[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [formOpen, setFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [periodLoading, setPeriodLoading] = useState(false);
  const hasDateFilter = Boolean(fromDate || toDate);

  const totals = useMemo(() => {
    const income = entries.filter((e) => e.direction === "INCOME").reduce((s, e) => s + e.totalAmount, 0);
    const expense = entries.filter((e) => e.direction === "EXPENSE").reduce((s, e) => s + e.totalAmount, 0);
    const pending = entries.filter((e) => e.status === "PENDING").reduce((s, e) => s + e.totalAmount, 0);
    return { income, expense, net: income - expense, pending };
  }, [entries]);

  const filtered = useMemo(() => {
    if (filter === "entradas") return entries.filter((e) => e.direction === "INCOME");
    if (filter === "despesas") return entries.filter((e) => e.direction === "EXPENSE");
    if (filter === "pendentes") return entries.filter((e) => e.status === "PENDING");
    return entries;
  }, [entries, filter]);

  const weeklyGroups = useMemo(() => {
    const grouped = new Map<string, { monday: Date; income: number; expense: number; count: number }>();
    for (const entry of entries) {
      const monday = getWeekMonday(entry.createdAt);
      const key = monday.toISOString();
      if (!grouped.has(key)) {
        grouped.set(key, { monday, income: 0, expense: 0, count: 0 });
      }
      const g = grouped.get(key)!;
      if (entry.direction === "INCOME") g.income += entry.totalAmount;
      else g.expense += entry.totalAmount;
      g.count++;
    }
    return Array.from(grouped.values()).sort((a, b) => b.monday.getTime() - a.monday.getTime());
  }, [entries]);

  const monthlyGroups = useMemo(() => {
    const grouped = new Map<string, { monthStart: Date; income: number; expense: number; count: number }>();
    for (const entry of entries) {
      const d = new Date(entry.createdAt);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped.has(key)) {
        grouped.set(key, { monthStart, income: 0, expense: 0, count: 0 });
      }
      const g = grouped.get(key)!;
      if (entry.direction === "INCOME") g.income += entry.totalAmount;
      else g.expense += entry.totalAmount;
      g.count++;
    }
    return Array.from(grouped.values()).sort((a, b) => b.monthStart.getTime() - a.monthStart.getTime());
  }, [entries]);

  function handleDateSearch() {
    setPeriodLoading(true);
    startTransition(async () => {
      try {
        const data = await listModuleFinancialEntriesAction(slug, fromDate || undefined, toDate || undefined);
        setEntries(data);
      } catch {
        setError("Não foi possível buscar esse período.");
      } finally {
        setPeriodLoading(false);
      }
    });
  }

  function clearDates() {
    setFromDate("");
    setToDate("");
    setEntries(initialEntries);
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildPrintHtml(moduleTitle, fromDate, toDate, entries, monthlyGroups));
    win.document.close();
    win.print();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const fd = new FormData(form);
    const payload = {
      description: String(fd.get("description") ?? "").trim(),
      totalAmount: Number(fd.get("totalAmount") ?? 0),
      direction: String(fd.get("direction") ?? "INCOME"),
      status: String(fd.get("status") ?? "PENDING"),
      paymentMethod: String(fd.get("paymentMethod") ?? "") || undefined,
    };

    startTransition(async () => {
      try {
        const created = await createModuleFinancialEntryAction(slug, payload);
        setEntries((prev) => [created, ...prev]);
        setFormOpen(false);
        form.reset();
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaved(true);
        savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
      } catch {
        setError("Não foi possível salvar. Confira os campos e tente novamente.");
      }
    });
  }

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "entradas", label: "Entradas" },
    { key: "despesas", label: "Despesas" },
    { key: "pendentes", label: "Pendentes" },
  ];

  return (
    <div className="space-y-4">

      {saved && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[#6b9d6f]/30 bg-[#0e1c10]/80 px-4 py-3 text-sm font-medium text-[#bfe3c2]">
          <CheckCircle2 className="size-4 shrink-0 text-[#6b9d6f]" />
          Lançamento salvo com sucesso!
        </div>
      )}

      {/* Filtro por período + imprimir */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <CalendarDays className="size-3.5 text-[#9a958b]" />
          <p className="text-xs font-semibold text-[#9a958b] uppercase tracking-wide">Filtrar por período</p>
          <button
            type="button"
            onClick={handlePrint}
            disabled={entries.length === 0}
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[rgba(245,241,232,0.12)] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-[#c9c2b4] transition hover:border-[rgba(245,241,232,0.22)] hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <Printer className="size-3.5" />
            PDF
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="flex-1 rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-[#d1a04f]/40 [color-scheme:dark]"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="flex-1 rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-[#d1a04f]/40 [color-scheme:dark]"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleDateSearch}
            disabled={periodLoading}
            className="flex-1 rounded-xl bg-[#d1a04f] py-2 text-xs font-semibold text-[#0d0a05] transition hover:bg-[#daa855] active:scale-[0.99] disabled:opacity-50"
          >
            {periodLoading ? <LoaderCircle className="mx-auto size-3.5 animate-spin" /> : "Buscar"}
          </button>
          {hasDateFilter ? (
            <button
              type="button"
              onClick={clearDates}
              className="rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-2 text-xs text-[#9a958b] transition hover:text-white active:scale-95"
            >
              Limpar
            </button>
          ) : null}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-2">
        <article className="rounded-2xl border border-[#6b9d6f]/25 bg-[#0e1c10]/70 p-3">
          <div className="flex items-center gap-1.5 text-[#8cc490]">
            <TrendingUp className="size-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]">Entradas</p>
          </div>
          <p className="mt-2 text-base font-bold text-[#bfe3c2]">{formatCurrency(totals.income)}</p>
        </article>
        <article className="rounded-2xl border border-[#b46c5d]/25 bg-[#1a0d0d]/70 p-3">
          <div className="flex items-center gap-1.5 text-[#d4806f]">
            <TrendingDown className="size-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]">Despesas</p>
          </div>
          <p className="mt-2 text-base font-bold text-[#f0a08f]">{formatCurrency(totals.expense)}</p>
        </article>
        <article className={cn(
          "rounded-2xl border p-3",
          totals.net >= 0
            ? "border-[#4a7cbf]/25 bg-[#0d1520]/70"
            : "border-[#b46c5d]/25 bg-[#1a0d0d]/70",
        )}>
          <div className={cn(
            "flex items-center gap-1.5",
            totals.net >= 0 ? "text-[#7aaee8]" : "text-[#d4806f]",
          )}>
            <Wallet className="size-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em]">Saldo</p>
          </div>
          <p className={cn(
            "mt-2 text-base font-bold",
            totals.net >= 0 ? "text-[#b8d4f5]" : "text-[#f0a08f]",
          )}>
            {formatCurrency(totals.net)}
          </p>
        </article>
      </div>

      {/* Formulário novo lançamento */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Lançamento avulso</h2>
            <p className="mt-0.5 text-xs text-[#9a958b]">Entrada ou despesa que não veio de uma operação.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((c) => !c)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#d1a04f] px-3 py-2 text-xs font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855] active:scale-95"
          >
            {formOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {formOpen ? "Cancelar" : "Novo"}
          </button>
        </div>

        {formOpen ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-[rgba(245,241,232,0.08)] pt-4">
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="mf-description">Descrição</label>
              <input
                id="mf-description"
                name="description"
                required
                className={fieldClass}
                placeholder="Ex: Pagamento recebido, custo de material..."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="mf-direction">Tipo</label>
                <select id="mf-direction" name="direction" className={selectClass} defaultValue="INCOME">
                  <option value="INCOME">Entrada</option>
                  <option value="EXPENSE">Despesa</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="mf-amount">Valor (R$)</label>
                <input
                  id="mf-amount"
                  name="totalAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  required
                  className={fieldClass}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="mf-status">Status</label>
                <select id="mf-status" name="status" className={selectClass} defaultValue="PENDING">
                  <option value="PENDING">Pendente</option>
                  <option value="PARTIAL">Parcial</option>
                  <option value="PAID">Pago</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="mf-method">Forma de pagamento</label>
                <select id="mf-method" name="paymentMethod" className={selectClass} defaultValue="">
                  <option value="">Não informado</option>
                  <option value="PIX">PIX</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="CARTAO">Cartão</option>
                  <option value="ABERTO">Aberto</option>
                </select>
              </div>
            </div>

            {error ? <p className="text-xs text-[#f0c9ad]">{error}</p> : null}

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#d1a04f] px-4 py-3 text-sm font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855] active:scale-[0.99] disabled:opacity-60"
            >
              {isPending ? "Salvando..." : "Salvar lançamento"}
            </button>
          </form>
        ) : null}
      </div>

      {/* Lista de lançamentos */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Lançamentos</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#c9c2b4]">
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {totals.pending > 0 ? (
              <span className="rounded-full border border-[#c9a84c]/35 bg-[#c9a84c]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f0d98a]">
                {formatCurrency(totals.pending)} pendente
              </span>
            ) : null}
            {/* Toggle Lista / Semanas / Meses */}
            <div className="flex rounded-xl border border-[rgba(245,241,232,0.1)] overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("lista")}
                title="Ver como lista"
                className={cn(
                  "flex min-h-9 items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition",
                  viewMode === "lista"
                    ? "bg-[#d1a04f]/20 text-[#f3dfae]"
                    : "bg-transparent text-[#9a958b] hover:text-[#c9c2b4]",
                )}
              >
                <List className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("semanas")}
                title="Ver por semana"
                className={cn(
                  "flex min-h-9 items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition border-l border-[rgba(245,241,232,0.1)]",
                  viewMode === "semanas"
                    ? "bg-[#d1a04f]/20 text-[#f3dfae]"
                    : "bg-transparent text-[#9a958b] hover:text-[#c9c2b4]",
                )}
              >
                <CalendarDays className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("meses")}
                title="Ver por mês"
                className={cn(
                  "flex min-h-9 items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition border-l border-[rgba(245,241,232,0.1)]",
                  viewMode === "meses"
                    ? "bg-[#d1a04f]/20 text-[#f3dfae]"
                    : "bg-transparent text-[#9a958b] hover:text-[#c9c2b4]",
                )}
              >
                <Table2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === "lista" ? (
          <>
            {/* Filtros */}
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                    filter === tab.key
                      ? "border-[#d1a04f]/50 bg-[#d1a04f]/15 text-[#f3dfae]"
                      : "border-[rgba(245,241,232,0.1)] bg-white/[0.025] text-[#9a958b] hover:text-[#c9c2b4]",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[rgba(245,241,232,0.1)] py-8 text-center">
                <p className="text-sm text-[#5a544c]">Nenhum lançamento encontrado.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {filtered.map((entry) => {
                  const isIncome = entry.direction === "INCOME";
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center gap-3 overflow-hidden rounded-xl border py-3 pl-3 pr-4",
                        isIncome
                          ? "border-[#6b9d6f]/20 bg-[#0e1c10]/50"
                          : "border-[#b46c5d]/20 bg-[#1a0d0d]/50",
                      )}
                    >
                      <div className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        isIncome ? "bg-[#6b9d6f]/15" : "bg-[#b46c5d]/15",
                      )}>
                        {isIncome
                          ? <ArrowDownLeft className="size-4 text-[#8cc490]" />
                          : <ArrowUpRight className="size-4 text-[#d4806f]" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{entry.description}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#9a958b]">
                          <span>{formatShortDate(entry.createdAt)}</span>
                          {entry.paymentMethod ? (
                            <><span>·</span><span>{METHOD_LABEL[entry.paymentMethod] ?? entry.paymentMethod}</span></>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={cn("text-sm font-bold", isIncome ? "text-[#bfe3c2]" : "text-[#f0a08f]")}>
                          {isIncome ? "+" : "-"}{formatCurrency(entry.totalAmount)}
                        </span>
                        <span className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          STATUS_COLOR[entry.status] ?? "border-white/10 bg-white/5 text-slate-400",
                        )}>
                          {STATUS_LABEL[entry.status] ?? entry.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : viewMode === "semanas" ? (
          /* VIEW SEMANAL */
          <div className="mt-3 space-y-2">
            {weeklyGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[rgba(245,241,232,0.1)] py-8 text-center">
                <p className="text-sm text-[#5a544c]">Nenhum lançamento encontrado.</p>
              </div>
            ) : weeklyGroups.map((week) => {
              const net = week.income - week.expense;
              return (
                <div
                  key={week.monday.toISOString()}
                  className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#0b0f0e]/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-3.5 shrink-0 text-[#9a958b]" />
                      <p className="text-[11px] font-semibold text-[#c9c2b4]">
                        {formatWeekLabel(week.monday)}
                      </p>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-[#9a958b]">
                        {week.count}
                      </span>
                    </div>
                    <span className={cn(
                      "text-sm font-bold",
                      net >= 0 ? "text-[#bfe3c2]" : "text-[#f0a08f]",
                    )}>
                      {net >= 0 ? "+" : ""}{formatCurrency(net)}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-[#9a958b]">
                    <span className="text-[#8cc490]">↓ {formatCurrency(week.income)}</span>
                    <span className="text-[#d4806f]">↑ {formatCurrency(week.expense)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* VIEW MENSAL */
          <div className="mt-3 space-y-2">
            {monthlyGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[rgba(245,241,232,0.1)] py-8 text-center">
                <p className="text-sm text-[#5a544c]">Nenhum lançamento encontrado.</p>
              </div>
            ) : monthlyGroups.map((month) => {
              const net = month.income - month.expense;
              return (
                <div
                  key={month.monthStart.toISOString()}
                  className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#0b0f0e]/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Table2 className="size-3.5 shrink-0 text-[#9a958b]" />
                      <p className="text-[11px] font-semibold capitalize text-[#c9c2b4]">
                        {formatMonthLabel(month.monthStart)}
                      </p>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-[#9a958b]">
                        {month.count}
                      </span>
                    </div>
                    <span className={cn(
                      "text-sm font-bold",
                      net >= 0 ? "text-[#bfe3c2]" : "text-[#f0a08f]",
                    )}>
                      {net >= 0 ? "+" : ""}{formatCurrency(net)}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-[#9a958b]">
                    <span className="text-[#8cc490]">↓ {formatCurrency(month.income)}</span>
                    <span className="text-[#d4806f]">↑ {formatCurrency(month.expense)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
