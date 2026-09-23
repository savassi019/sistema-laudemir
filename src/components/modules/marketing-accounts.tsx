"use client";

import { Check, LoaderCircle, Plus, Trash2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import {
  addAgencyFinanceEntryAction,
  deleteMarketingEntryAction,
  getMarketingFinanceOverviewAction,
  setMarketingEntryPaidAction,
  type MarketingFinanceEntry,
} from "@/server/actions/marketing-actions";

const fieldCls =
  "w-full rounded-xl border border-[rgba(245,241,232,0.12)] bg-[#0b0f0e]/60 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-[#5a544c] focus:outline-none focus:ring-1 focus:ring-[#7b6fc0]/50";

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type Filtro = "todos" | "despesas" | "a-pagar";

/**
 * "Contas" do Marketing: despesas da agencia (sem cliente vinculado) +
 * uma visao de tudo que ja e lancado dentro de cada cliente, na mesma
 * lista. O usuario pediu de volta depois que as abas genericas
 * Financeiro/Contas foram escondidas por duplicarem os Lancamentos por
 * cliente sem se falar com eles -- esta tela usa a MESMA tabela, entao
 * nao reabre aquele problema: uma despesa lancada aqui aparece certa em
 * qualquer relatorio que some por module=MARKETING.
 */
export function MarketingAccounts({ hideFinancials = false }: { hideFinancials?: boolean } = {}) {
  const [entries, setEntries] = useState<MarketingFinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [addingOpen, setAddingOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getMarketingFinanceOverviewAction()
      .then((items) => {
        if (active) setEntries(items);
      })
      .catch(() => {
        if (active) setEntries([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const totais = useMemo(() => {
    const despesas = entries.filter((e) => e.direction === "EXPENSE").reduce((s, e) => s + e.amount, 0);
    const aPagar = entries
      .filter((e) => e.direction === "EXPENSE" && !e.paid)
      .reduce((s, e) => s + e.amount, 0);
    const aReceber = entries
      .filter((e) => e.direction === "INCOME" && !e.paid)
      .reduce((s, e) => s + e.amount, 0);
    return { despesas, aPagar, aReceber };
  }, [entries]);

  const filtered = entries.filter((e) => {
    if (filtro === "despesas") return e.direction === "EXPENSE";
    if (filtro === "a-pagar") return !e.paid;
    return true;
  });

  function handleAdded(item: MarketingFinanceEntry) {
    setEntries((prev) => [item, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setAddingOpen(false);
  }

  async function handleTogglePaid(entry: MarketingFinanceEntry) {
    const anterior = entries;
    const paid = !entry.paid;
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, paid } : e)));
    setErro(null);
    try {
      await setMarketingEntryPaidAction(entry.id, paid);
    } catch {
      setEntries(anterior);
      setErro("Não foi possível salvar. Confira a internet e tente de novo.");
    }
  }

  async function handleDelete(id: string) {
    const anterior = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setErro(null);
    try {
      await deleteMarketingEntryAction(id);
    } catch {
      setEntries(anterior);
      setErro("Não foi possível excluir. Tente de novo.");
    }
  }

  if (hideFinancials) {
    return (
      <p className="px-1 py-4 text-sm text-[#9a958b]">
        Contas fica visível só para quem enxerga valores no sistema.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoaderCircle className="size-6 animate-spin text-[#9a958b]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0c100f]/80 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9a958b]">Despesas</p>
          <p className="mt-1 text-sm font-bold leading-tight text-[#fca5a5]">{formatCurrency(totais.despesas)}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0c100f]/80 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9a958b]">A pagar</p>
          <p className="mt-1 text-sm font-bold leading-tight text-[#f3dfae]">{formatCurrency(totais.aPagar)}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0c100f]/80 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9a958b]">A receber</p>
          <p className="mt-1 text-sm font-bold leading-tight text-[#86efac]">{formatCurrency(totais.aReceber)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {([
            { key: "todos" as const, label: "Todas" },
            { key: "despesas" as const, label: "Despesas" },
            { key: "a-pagar" as const, label: "Em aberto" },
          ]).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              className={cn(
                "flex min-h-11 shrink-0 items-center rounded-xl border px-3 text-xs font-medium transition",
                filtro === f.key
                  ? "border-[#7b6fc0]/40 bg-[#7b6fc0]/12 text-[#c8bef5]"
                  : "border-white/10 bg-white/[0.03] text-[#9a958b] active:bg-white/[0.07]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAddingOpen((x) => !x)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#7b6fc0] px-3 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(123,111,192,0.35)] transition active:scale-[0.98]"
        >
          <Plus className="size-3.5" />
          Nova
        </button>
      </div>

      {addingOpen && <AddAgencyEntryForm onAdded={handleAdded} onCancel={() => setAddingOpen(false)} />}

      {erro && (
        <p className="rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#fca5a5]">
          {erro}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,241,232,0.12)] bg-white/[0.02] px-4 py-10 text-center">
          <Wallet className="mb-3 size-7 text-[#5a544c]" />
          <p className="text-sm text-[#9a958b]">
            {filtro === "todos"
              ? "Nada lançado ainda. Despesas de cliente ficam dentro do cliente, em Clientes e funil."
              : "Nada aqui com esse filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((e) => {
            const receita = e.direction === "INCOME";
            return (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-xl border border-[rgba(245,241,232,0.06)] bg-white/[0.02] px-2.5 py-2"
              >
                <button
                  type="button"
                  onClick={() => handleTogglePaid(e)}
                  title={e.paid ? "Marcar como em aberto" : "Marcar como pago"}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border transition",
                    e.paid
                      ? "border-[#4ade80]/50 bg-[#4ade80]/15 text-[#4ade80]"
                      : "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-transparent",
                  )}
                >
                  <Check className="size-3.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">{e.description}</p>
                  <p className="truncate text-[10px] text-[#9a958b]">
                    {fmtShortDate(e.date)} · {e.clientName ?? "Despesa da agência"}
                    {!e.paid && <span className="ml-1.5 font-semibold text-[#f59e0b]">em aberto</span>}
                  </p>
                </div>
                <p className={cn("shrink-0 text-xs font-semibold tabular-nums", receita ? "text-[#4ade80]" : "text-[#f87171]")}>
                  {receita ? "+" : "-"}
                  {formatCurrency(e.amount)}
                </p>
                <button
                  type="button"
                  onClick={() => handleDelete(e.id)}
                  className="shrink-0 rounded-md p-1 text-[#5a544c] transition active:text-[#f87171]"
                  title="Excluir"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddAgencyEntryForm({
  onAdded,
  onCancel,
}: {
  onAdded: (item: MarketingFinanceEntry) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paid, setPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valor = Number(amount.replace(",", "."));
  const podeSalvar = description.trim().length > 0 && Number.isFinite(valor) && valor > 0;

  async function handleSave() {
    if (!podeSalvar) return;
    setSaving(true);
    setErro(null);
    try {
      const item = await addAgencyFinanceEntryAction({
        description: description.trim(),
        direction,
        amount: valor,
        date,
        paid,
      });
      onAdded(item);
    } catch {
      setErro("Não foi possível salvar. Confira a internet e tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-[#7b6fc0]/20 bg-[#7b6fc0]/5 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c8bef5]">
        Conta da agência · sem cliente
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {([
          { key: "EXPENSE" as const, label: "Despesa",      cls: "text-[#f87171] border-[#f87171]/40 bg-[#f87171]/10" },
          { key: "INCOME" as const,  label: "Outra receita", cls: "text-[#4ade80] border-[#4ade80]/40 bg-[#4ade80]/10" },
        ]).map((op) => (
          <button
            key={op.key}
            type="button"
            onClick={() => setDirection(op.key)}
            className={cn(
              "rounded-xl border py-2.5 text-xs font-semibold transition",
              direction === op.key
                ? op.cls
                : "border-[rgba(245,241,232,0.1)] text-[#9a958b] active:border-[rgba(245,241,232,0.25)]",
            )}
          >
            {op.label}
          </button>
        ))}
      </div>

      <input
        className={fieldCls}
        placeholder={direction === "EXPENSE" ? "Ex.: Canva, anúncios, aluguel" : "Ex.: consultoria avulsa"}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        autoFocus
      />

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          className={cn(fieldCls, "flex-1")}
          placeholder="R$ 0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="date"
          className={cn(fieldCls, "flex-1")}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={() => setPaid((x) => !x)}
        className="flex w-full items-center gap-2.5 rounded-xl px-1 py-2 text-left"
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border transition",
            paid
              ? "border-[#4ade80]/50 bg-[#4ade80]/15 text-[#4ade80]"
              : "border-[rgba(245,241,232,0.15)] text-transparent",
          )}
        >
          <Check className="size-3.5" />
        </span>
        <span className="text-xs text-[#d6d1c7]">
          {direction === "EXPENSE" ? "Já paguei" : "Já recebi"}
        </span>
      </button>

      {erro ? (
        <p className="rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#fca5a5]">
          {erro}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !podeSalvar}
          className="flex-1 rounded-xl bg-[#7b6fc0] py-2.5 text-xs font-semibold text-white transition active:bg-[#8a7fd4] disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="mx-auto size-3.5 animate-spin" /> : "Salvar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-[rgba(245,241,232,0.1)] px-4 py-2.5 text-xs text-[#9a958b] transition active:text-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
