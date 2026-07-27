"use client";

import { Check, ChevronDown, Clock, Inbox, Minus, Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  createModuleFinancialEntryAction,
  updateModuleFinancialEntryStatusAction,
} from "@/server/actions/finance-actions";
import type { ModuleFinancialEntryItem } from "@/server/services/finance-service";
import { fieldClass, labelClass, selectClass } from "./styles";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "border-[#f87171]/35 bg-[#f87171]/10 text-[#fca5a5]",
  PARTIAL: "border-[#c9a84c]/35 bg-[#c9a84c]/10 text-[#f0d98a]",
  PAID: "border-[#6b9d6f]/35 bg-[#6b9d6f]/10 text-[#bfe3c2]",
};

const DIR_LABEL: Record<string, string> = {
  INCOME: "A receber",
  EXPENSE: "A pagar",
};

export function ModuleAccountsPayable({
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

  const pending = useMemo(
    () => entries.filter((e) => e.status === "PENDING" || e.status === "PARTIAL"),
    [entries],
  );

  const totalPending = useMemo(
    () => pending.filter((e) => e.direction === "INCOME").reduce((s, e) => s + e.totalAmount, 0),
    [pending],
  );
  const totalPayable = useMemo(
    () => pending.filter((e) => e.direction === "EXPENSE").reduce((s, e) => s + e.totalAmount, 0),
    [pending],
  );

  function markStatus(id: string, status: "PENDING" | "PARTIAL" | "PAID") {
    startTransition(async () => {
      try {
        const updated = await updateModuleFinancialEntryStatusAction(id, status);
        setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      } catch {
        // silently ignore — optimistic update reverted on reload
      }
    });
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
      status: "PENDING",
      paymentMethod: String(fd.get("paymentMethod") ?? "") || undefined,
    };

    startTransition(async () => {
      try {
        const created = await createModuleFinancialEntryAction(slug, payload);
        setEntries((prev) => [created, ...prev]);
        setFormOpen(false);
        form.reset();
      } catch {
        setError("Não foi possível salvar. Tente novamente.");
      }
    });
  }

  return (
    <div className="space-y-4">

      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-2">
        <article className="rounded-2xl border border-[#6b9d6f]/25 bg-[#0e1c10]/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8cc490]">
            A receber
          </p>
          <p className="mt-2 text-base font-bold text-[#bfe3c2]">{formatCurrency(totalPending)}</p>
          <p className="mt-0.5 text-[10px] text-[#9a958b]">pendente/parcial</p>
        </article>
        <article className="rounded-2xl border border-[#b46c5d]/25 bg-[#1a0d0d]/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d4806f]">
            A pagar
          </p>
          <p className="mt-2 text-base font-bold text-[#f0a08f]">{formatCurrency(totalPayable)}</p>
          <p className="mt-0.5 text-[10px] text-[#9a958b]">pendente/parcial</p>
        </article>
      </div>

      {/* Novo lançamento */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Nova conta</h2>
            <p className="mt-0.5 text-xs text-[#9a958b]">Adicionar conta a receber ou a pagar.</p>
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
              <label className={labelClass} htmlFor="ap-description">Descrição</label>
              <input
                id="ap-description"
                name="description"
                required
                className={fieldClass}
                placeholder="Ex: Aluguel pendente, material..."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="ap-direction">Tipo</label>
                <select id="ap-direction" name="direction" className={selectClass} defaultValue="INCOME">
                  <option value="INCOME">A receber (entrada)</option>
                  <option value="EXPENSE">A pagar (saída)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="ap-amount">Valor (R$)</label>
                <input
                  id="ap-amount"
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
                <label className={labelClass} htmlFor="ap-method">Forma de pagamento</label>
                <select id="ap-method" name="paymentMethod" className={selectClass} defaultValue="">
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
              {isPending ? "Salvando..." : "Salvar conta"}
            </button>
          </form>
        ) : null}
      </div>

      {/* Lista de pendências */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-[#c9a84c]" />
          <h2 className="text-sm font-semibold text-white">Pendentes</h2>
          <span className="rounded-full border border-[#c9a84c]/35 bg-[#c9a84c]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f0d98a]">
            {pending.length}
          </span>
        </div>

        {pending.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(245,241,232,0.1)] py-10 text-center">
            <Inbox className="mb-2 size-6 text-[#5a544c]" />
            <p className="text-sm text-[#9a958b]">Nenhuma conta pendente.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {pending.map((entry) => {
              const isIncome = entry.direction === "INCOME";
              return (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-2xl border p-3",
                    entry.status === "PENDING"
                      ? "border-[#f87171]/18 bg-[#1a0a0a]/60"
                      : "border-[#c9a84c]/18 bg-[#1a1408]/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                          isIncome
                            ? "border-[#6b9d6f]/35 bg-[#6b9d6f]/10 text-[#bfe3c2]"
                            : "border-[#b46c5d]/35 bg-[#b46c5d]/10 text-[#f0a08f]",
                        )}>
                          {DIR_LABEL[entry.direction]}
                        </span>
                        <span className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                          STATUS_COLOR[entry.status],
                        )}>
                          {STATUS_LABEL[entry.status]}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium text-white">{entry.description}</p>
                      <p className="mt-0.5 text-xs text-[#9a958b]">{formatShortDate(entry.createdAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-sm font-bold", isIncome ? "text-[#bfe3c2]" : "text-[#f0a08f]")}>
                        {formatCurrency(entry.totalAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="mt-2.5 flex gap-1.5">
                    {entry.status !== "PAID" ? (
                      <button
                        type="button"
                        onClick={() => markStatus(entry.id, "PAID")}
                        disabled={isPending}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#6b9d6f]/35 bg-[#6b9d6f]/10 py-2 text-xs font-semibold text-[#bfe3c2] transition hover:bg-[#6b9d6f]/18 disabled:opacity-50"
                      >
                        <Check className="size-3.5" />
                        Pago
                      </button>
                    ) : null}
                    {entry.status === "PENDING" ? (
                      <button
                        type="button"
                        onClick={() => markStatus(entry.id, "PARTIAL")}
                        disabled={isPending}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#c9a84c]/35 bg-[#c9a84c]/10 py-2 text-xs font-semibold text-[#f0d98a] transition hover:bg-[#c9a84c]/18 disabled:opacity-50"
                      >
                        <Minus className="size-3.5" />
                        Parcial
                      </button>
                    ) : null}
                    {entry.status === "PARTIAL" ? (
                      <button
                        type="button"
                        onClick={() => markStatus(entry.id, "PENDING")}
                        disabled={isPending}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[#9a958b] transition hover:text-white disabled:opacity-50"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    ) : null}
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
