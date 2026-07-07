"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { createModuleFinancialEntryAction } from "@/server/actions/finance-actions";
import type { ModuleFinancialEntryItem } from "@/server/services/finance-service";
import { fieldClass, labelClass, selectClass } from "./styles";

const statusLabel: Record<ModuleFinancialEntryItem["status"], "pendente" | "parcial" | "pago"> = {
  PENDING: "pendente",
  PARTIAL: "parcial",
  PAID: "pago",
};

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
      } catch {
        setError("Nao foi possivel salvar. Confira os campos e tente novamente.");
      }
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Lançamento financeiro</h2>
            <p className="mt-1 text-sm text-[#9a958b]">Entrada ou despesa avulsa deste módulo.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((current) => !current)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#d1a04f] px-3 py-2 text-xs font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855]"
          >
            {formOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {formOpen ? "Cancelar" : "Novo"}
          </button>
        </div>

        {formOpen ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="module-finance-description">
                Descrição
              </label>
              <input
                id="module-finance-description"
                name="description"
                required
                className={fieldClass}
                placeholder="Ex: Pagamento recebido fora do fluxo"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="module-finance-amount">
                  Valor
                </label>
                <input
                  id="module-finance-amount"
                  name="totalAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  required
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="module-finance-direction">
                  Tipo
                </label>
                <select id="module-finance-direction" name="direction" className={selectClass} defaultValue="INCOME">
                  <option value="INCOME">Entrada</option>
                  <option value="EXPENSE">Despesa</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="module-finance-status">
                  Status
                </label>
                <select id="module-finance-status" name="status" className={selectClass} defaultValue="PENDING">
                  <option value="PENDING">Pendente</option>
                  <option value="PARTIAL">Parcial</option>
                  <option value="PAID">Pago</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="module-finance-method">
                  Pagamento
                </label>
                <select id="module-finance-method" name="paymentMethod" className={selectClass} defaultValue="">
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

      <section className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Lançamentos do módulo</h2>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-[#c9c2b4]">
            {entries.length}
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 py-2 text-center text-sm text-[#5a544c]">Nenhum lançamento financeiro ainda.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(245,241,232,0.08)] bg-white/[0.025] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{entry.description}</p>
                  <p className="text-xs text-[#9a958b]">
                    {entry.direction === "INCOME" ? "Entrada" : "Despesa"} · {formatShortDate(entry.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-white">{formatCurrency(entry.totalAmount)}</span>
                  <StatusBadge label={statusLabel[entry.status]} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
