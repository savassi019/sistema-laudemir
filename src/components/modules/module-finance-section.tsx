"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, List, Plus, TrendingDown, TrendingUp, Wallet, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { createModuleFinancialEntryAction } from "@/server/actions/finance-actions";
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
type ViewMode = "lista" | "semanas";

export function ModuleFinanceSection({
  slug,
  initialEntries,
}: {
  slug: string;
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
            <h2 className="text-sm font-semibold text-white">Lançamento financeiro</h2>
            <p className="mt-0.5 text-xs text-[#9a958b]">Entrada ou despesa avulsa deste módulo.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((c) => !c)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#d1a04f] px-3 py-2 text-xs font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855]"
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
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#d1a04f] px-4 py-3 text-sm font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855] disabled:opacity-60"
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
            {/* Toggle Lista / Semanas */}
            <div className="flex rounded-xl border border-[rgba(245,241,232,0.1)] overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("lista")}
                title="Ver como lista"
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition",
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
                  "flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition border-l border-[rgba(245,241,232,0.1)]",
                  viewMode === "semanas"
                    ? "bg-[#d1a04f]/20 text-[#f3dfae]"
                    : "bg-transparent text-[#9a958b] hover:text-[#c9c2b4]",
                )}
              >
                <CalendarDays className="size-3.5" />
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
        ) : (
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
        )}
      </div>
    </div>
  );
}
