"use client";

import { ChevronDown, Download, X } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatShortDate } from "@/lib/format";
import type { FinanceEntryListItem } from "@/types/app";

type Status = FinanceEntryListItem["status"] | "todos";
type Period = "todos" | "mes" | "mes-passado" | "30d";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pago", label: "Pago" },
  { value: "parcial", label: "Parcial" },
  { value: "pendente", label: "Pendente" },
  { value: "atrasado", label: "Atrasado" },
];

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "mes", label: "Este mês" },
  { value: "mes-passado", label: "Mês passado" },
  { value: "30d", label: "30 dias" },
];

function getPeriodRange(period: Period): { start?: number; end?: number } {
  const now = new Date();
  if (period === "mes") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime(),
    };
  }
  if (period === "mes-passado") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime(),
    };
  }
  if (period === "30d") {
    return { start: now.getTime() - 30 * 86_400_000 };
  }
  return {};
}

export function FinanceEntries({ entries }: { entries: FinanceEntryListItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status>("todos");
  const [periodFilter, setPeriodFilter] = useState<Period>("todos");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let result = entries;
    if (statusFilter !== "todos") {
      result = result.filter((e) => e.status === statusFilter);
    }
    if (periodFilter !== "todos") {
      const { start, end } = getPeriodRange(periodFilter);
      result = result.filter((e) => {
        const t = new Date(e.dueDate).getTime();
        if (start !== undefined && t < start) return false;
        if (end !== undefined && t > end) return false;
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.customer ?? "").toLowerCase().includes(q) ||
          e.reference.toLowerCase().includes(q) ||
          e.module.toLowerCase().includes(q),
      );
    }
    return result;
  }, [entries, statusFilter, periodFilter, searchQuery]);

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function exportCsv() {
    const header = ["Referência", "Descrição", "Módulo", "Cliente", "Status", "Valor", "Pago", "Saldo", "Vencimento", "Pagamento"];
    const rows = filtered.map((e) => [
      e.reference,
      e.description,
      e.module,
      e.customer ?? "",
      e.status,
      String(e.amount),
      String(e.paid),
      String(e.remaining),
      e.dueDate.slice(0, 10),
      e.method,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "financeiro.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#0b0f0e]/70 px-3 py-2 min-w-[160px]">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-transparent text-base md:text-sm text-white outline-none placeholder:text-[#7e786d]"
            />
            {searchQuery ? (
              <button type="button" onClick={() => setSearchQuery("")}>
                <X className="size-3.5 text-[#9a958b]" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-[#c9c2b4] transition hover:bg-white/[0.07]"
          >
            <Download className="size-3.5" />
            CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="self-center text-[11px] uppercase tracking-widest text-[#5a544c]">Período</span>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriodFilter(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                periodFilter === opt.value
                  ? "bg-[#d1a04f]/20 text-[#f3dfae] border border-[#d1a04f]/35"
                  : "border border-white/10 bg-white/[0.03] text-[#9a958b] hover:bg-white/[0.06]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="self-center text-[11px] uppercase tracking-widest text-[#5a544c]">Status</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === opt.value
                  ? "bg-[#d1a04f]/20 text-[#f3dfae] border border-[#d1a04f]/35"
                  : "border border-white/10 bg-white/[0.03] text-[#9a958b] hover:bg-white/[0.06]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
          {[
            {
              label: "Total",
              value: filtered.reduce((s, e) => s + e.amount, 0),
              color: "text-white",
            },
            {
              label: "Pago",
              value: filtered.reduce((s, e) => s + e.paid, 0),
              color: "text-[#8aa17c]",
            },
            {
              label: "Saldo",
              value: filtered.reduce((s, e) => s + e.remaining, 0),
              color: "text-[#f87171]",
            },
          ].map((col) => (
            <div key={col.label} className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-[#5a544c]">{col.label}</p>
              <p className={`mt-1 text-sm font-semibold ${col.color}`}>
                {formatCurrency(col.value)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-[#9a958b]">{filtered.length} lançamento(s)</p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center text-sm text-[#5a544c]">
          Nenhum lançamento encontrado.
        </div>
      ) : null}

      <div className="grid gap-4 lg:hidden">
        {filtered.map((entry) => (
          <article
            key={entry.id}
            className="rounded-[24px] border border-white/8 bg-slate-950/55 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {entry.reference}
                </p>
                <h3 className="text-base font-semibold text-white">
                  {entry.description}
                </h3>
                <p className="text-sm text-slate-400">
                  {entry.module}
                  {entry.customer ? ` - ${entry.customer}` : ""}
                </p>
              </div>
              <StatusBadge label={entry.status} />
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Valor</span>
                <span>{formatCurrency(entry.amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Pago</span>
                <span>{formatCurrency(entry.paid)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Saldo</span>
                <span>{formatCurrency(entry.remaining)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Vencimento</span>
                <span>{formatShortDate(entry.dueDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Pagamento</span>
                <span>{entry.method}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden lg:grid gap-3">
        {filtered.map((entry) => {
          const open = expandedId === entry.id;
          return (
            <article
              key={entry.id}
              className="overflow-hidden rounded-[26px] border border-white/8 bg-slate-950/55"
            >
              <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr_0.8fr_160px]">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                      {entry.reference}
                    </p>
                    <StatusBadge label={entry.status} />
                  </div>
                  <h3 className="text-base font-semibold text-white">{entry.description}</h3>
                  <p className="text-sm text-slate-400">
                    {entry.module}
                    {entry.customer ? ` - ${entry.customer}` : ""}
                  </p>
                </div>

                <div className="space-y-2 text-sm text-slate-300">
                  <p>
                    <span className="text-slate-500">Valor:</span>{" "}
                    {formatCurrency(entry.amount)}
                  </p>
                  <p>
                    <span className="text-slate-500">Pago:</span>{" "}
                    {formatCurrency(entry.paid)}
                  </p>
                  <p>
                    <span className="text-slate-500">Saldo:</span>{" "}
                    {formatCurrency(entry.remaining)}
                  </p>
                </div>

                <div className="space-y-2 text-sm text-slate-300">
                  <p>
                    <span className="text-slate-500">Vencimento:</span>{" "}
                    {formatShortDate(entry.dueDate)}
                  </p>
                  <p>
                    <span className="text-slate-500">Pagamento:</span> {entry.method}
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => toggle(entry.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  >
                    {open ? "Fechar" : "Ver detalhes"}
                    <ChevronDown
                      className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {open ? (
                <div className="border-t border-white/8 bg-white/[0.02] px-5 py-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DetailRow label="Referência" value={entry.reference} />
                    <DetailRow label="Módulo" value={entry.module} />
                    <DetailRow label="Método" value={entry.method} />
                    <DetailRow label="Vencimento" value={formatShortDate(entry.dueDate)} />
                    <DetailRow label="Valor total" value={formatCurrency(entry.amount)} />
                    <DetailRow label="Pago" value={formatCurrency(entry.paid)} />
                    <DetailRow label="Saldo restante" value={formatCurrency(entry.remaining)} />
                    {entry.customer ? (
                      <DetailRow label="Cliente" value={entry.customer} />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
