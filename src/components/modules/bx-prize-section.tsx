"use client";

import { Award, CheckCircle2 } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { createModuleFinancialEntryAction } from "@/server/actions/finance-actions";
import type { ModuleFinancialEntryItem } from "@/server/services/finance-service";
import { fieldClass, hintClass, labelClass, selectClass } from "./styles";

/**
 * Prêmio pago direto ao cliente pelo funcionario (fora do fluxo normal de
 * agente/recebedor do BX) -- dinheiro sai do caixa sem passar por uma
 * operacao. Guarda como despesa na MESMA tabela do "Financeiro" do modulo
 * (nao um lancamento paralelo) so o relatorio ja soma sozinho -- so marca
 * com este prefixo fixo pra dar pra filtrar so os premios da lista.
 */
const PRIZE_PREFIX = "Prêmio pago — ";

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  ABERTO: "Aberto",
};

export function BxPrizeSection({
  hideFinancials = false,
  financialEntries,
}: {
  hideFinancials?: boolean;
  financialEntries: ModuleFinancialEntryItem[];
}) {
  const [entries, setEntries] = useState(financialEntries);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prizeEntries = useMemo(
    () => entries.filter((e) => e.description.startsWith(PRIZE_PREFIX)),
    [entries],
  );

  const total = useMemo(
    () => prizeEntries.reduce((s, e) => s + e.totalAmount, 0),
    [prizeEntries],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const fd = new FormData(form);
    const clientName = String(fd.get("clientName") ?? "").trim();
    const motivo = String(fd.get("motivo") ?? "").trim();
    const description = `${PRIZE_PREFIX}${clientName}${motivo ? " · " + motivo : ""}`;

    const payload = {
      description,
      totalAmount: Number(fd.get("totalAmount") ?? 0),
      direction: "EXPENSE",
      status: "PAID",
      paymentMethod: String(fd.get("paymentMethod") ?? "") || undefined,
    };

    startTransition(async () => {
      try {
        const created = await createModuleFinancialEntryAction("bx", payload);
        setEntries((prev) => [created, ...prev]);
        form.reset();
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaved(true);
        savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
      } catch {
        setError("Não foi possível salvar. Confira os campos e tente novamente.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[#d1a04f]/28 bg-[#3a2b18]/72 p-4 text-sm leading-6 text-[#f3dfae]">
        <p className="font-medium">Prêmio pago direto ao cliente</p>
        <p>
          Use aqui quando o funcionário paga o cliente sozinho, sem passar
          pelo fluxo normal do agente. Fica registrado de onde saiu o
          dinheiro do caixa.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[#6b9d6f]/30 bg-[#0e1c10]/80 px-4 py-3 text-sm font-medium text-[#bfe3c2]">
          <CheckCircle2 className="size-4 shrink-0 text-[#6b9d6f]" />
          Prêmio registrado com sucesso!
        </div>
      )}

      {!hideFinancials ? (
        <div className="rounded-2xl border border-[#b46c5d]/25 bg-[#1a0d0d]/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d4806f]">
            Total pago em prêmios
          </p>
          <p className="mt-1 text-base font-bold text-[#f0a08f]">{formatCurrency(total)}</p>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4"
      >
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="prize-client">
            Cliente
          </label>
          <input id="prize-client" name="clientName" required className={fieldClass} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="prize-amount">
              Valor pago (R$)
            </label>
            <input
              id="prize-amount"
              name="totalAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="prize-method">
              Saiu como
            </label>
            <select id="prize-method" name="paymentMethod" className={selectClass} defaultValue="DINHEIRO">
              <option value="DINHEIRO">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="CARTAO">Cartão</option>
              <option value="ABERTO">Aberto</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="prize-motivo">
            Motivo <span className="text-[#9a958b]">opcional</span>
          </label>
          <input id="prize-motivo" name="motivo" className={fieldClass} />
        </div>

        {error ? <p className="text-xs text-[#f0c9ad]">{error}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#d1a04f] px-4 py-3 text-sm font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855] disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Registrar prêmio pago"}
        </button>
      </form>

      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Prêmios registrados</h2>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#c9c2b4]">
            {prizeEntries.length}
          </span>
        </div>

        {prizeEntries.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[rgba(245,241,232,0.1)] py-8 text-center">
            <p className="text-sm text-[#5a544c]">Nenhum prêmio registrado ainda.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {prizeEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 overflow-hidden rounded-xl border border-[#b46c5d]/20 bg-[#1a0d0d]/50 py-3 pl-3 pr-4"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#b46c5d]/15">
                  <Award className="size-4 text-[#d4806f]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {entry.description.slice(PRIZE_PREFIX.length)}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#9a958b]">
                    <span>{formatShortDate(entry.createdAt)}</span>
                    {entry.paymentMethod ? (
                      <>
                        <span>·</span>
                        <span>{METHOD_LABEL[entry.paymentMethod] ?? entry.paymentMethod}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                {hideFinancials ? null : (
                  <span className="shrink-0 text-sm font-bold text-[#f0a08f]">
                    -{formatCurrency(entry.totalAmount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className={hintClass}>
        Também soma no Financeiro e no Relatório do módulo, como despesa.
      </p>
    </div>
  );
}
