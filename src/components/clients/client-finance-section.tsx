"use client";

import { Plus, ReceiptText, X } from "lucide-react";
import { useState, useTransition } from "react";

import { fieldClass, labelClass, selectClass } from "@/components/modules/styles";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { createFinancialEntryAction } from "@/server/actions/finance-actions";
import type { FinanceEntryListItem } from "@/types/app";

export function ClientFinanceSection({
  clientId,
  clientName,
  initialEntries,
}: {
  clientId: string;
  clientName: string;
  initialEntries: FinanceEntryListItem[];
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
      clientId,
      clientName,
      description: String(fd.get("description") ?? "").trim(),
      totalAmount: Number(fd.get("totalAmount") ?? 0),
      dueDate: String(fd.get("dueDate") ?? "") || undefined,
      kind: String(fd.get("kind") ?? "RECEIVABLE"),
      paymentMethod: String(fd.get("paymentMethod") ?? "") || undefined,
    };

    startTransition(async () => {
      try {
        const created = await createFinancialEntryAction(payload);
        setEntries((prev) => [created, ...prev]);
        setFormOpen(false);
        form.reset();
      } catch {
        setError("Nao foi possivel salvar. Confira os campos e tente novamente.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-4 md:p-5">
      <div className="flex items-center gap-2">
        <ReceiptText className="size-4 text-[#d1a04f]" />
        <h2 className="text-base font-semibold text-white">Financeiro</h2>
        <span className="text-xs text-[#9a958b]">
          {entries.length} lançamento{entries.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-2.5 py-1.5 text-xs font-semibold text-[#f3dfae] transition hover:bg-[#d1a04f]/18"
        >
          {formOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {formOpen ? "Cancelar" : "Nova cobrança"}
        </button>
      </div>

      {formOpen ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2.5 rounded-xl border border-white/10 bg-[#0b0f0e]/55 p-3">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="col-span-2 block space-y-1">
              <span className={labelClass}>Descrição</span>
              <input name="description" required className={fieldClass} placeholder="Ex: Mensalidade junho" />
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>Valor</span>
              <input name="totalAmount" type="number" inputMode="decimal" step="0.01" min="0.01" required className={fieldClass} />
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>Vencimento</span>
              <input name="dueDate" type="date" className={fieldClass} />
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>Tipo</span>
              <select name="kind" className={selectClass} defaultValue="RECEIVABLE">
                <option value="RECEIVABLE">A receber</option>
                <option value="PAYABLE">A pagar</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>Pagamento</span>
              <select name="paymentMethod" className={selectClass} defaultValue="">
                <option value="">Não informado</option>
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO">Cartão</option>
                <option value="ABERTO">Aberto</option>
              </select>
            </label>
          </div>
          {error ? <p className="text-xs text-[#f0c9ad]">{error}</p> : null}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-[#d1a04f] py-2.5 text-sm font-semibold text-[#0d0a05] disabled:opacity-60"
          >
            {isPending ? "Salvando..." : "Salvar cobrança"}
          </button>
        </form>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-3 py-2 text-center text-sm text-[#5a544c]">
          Nenhum lançamento ainda.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/55 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{e.description}</p>
                <p className="text-xs text-[#9a958b]">
                  {e.module} · {formatShortDate(e.dueDate)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold text-white">{formatCurrency(e.amount)}</span>
                <StatusBadge label={e.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
