"use client";

import { CheckCircle2, LockKeyhole, RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { closeBusinessDayAction, reopenBusinessDayAction } from "@/server/actions/daily-close-actions";
import type { DailyCloseSnapshot } from "@/server/services/daily-close-service";

const fieldClass =
  "min-h-12 w-full rounded-xl border border-white/10 bg-[#0b0f0e] px-3 text-base text-white outline-none focus:border-[#d1a04f]/60";

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
}

export function DailyClosePanel({ snapshot }: { snapshot: DailyCloseSnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cash, setCash] = useState(snapshot.expectedCash);
  const [pix, setPix] = useState(snapshot.expectedPix);
  const [card, setCard] = useState(snapshot.expectedCard);
  const [other, setOther] = useState(snapshot.expectedOther);
  const [reason, setReason] = useState("");

  const counted = cash + pix + card + other;
  const difference = useMemo(() => counted - snapshot.expectedIncome, [counted, snapshot.expectedIncome]);
  const currentClose = snapshot.closed;
  const isClosed = currentClose?.status === "CLOSED";

  function submitClose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await closeBusinessDayAction({
          businessDate: snapshot.businessDate,
          countedCash: cash,
          countedPix: pix,
          countedCard: card,
          countedOther: other,
          notes: String(form.get("notes") ?? ""),
        });
        setSuccess("Dia fechado e conferência registrada.");
        router.refresh();
      } catch (caught) {
        setError(messageOf(caught));
      }
    });
  }

  function submitReopen(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentClose) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await reopenBusinessDayAction({ id: currentClose.id, reason });
        setReason("");
        setSuccess("Dia reaberto. Novos lançamentos voltaram a ser permitidos.");
        router.refresh();
      } catch (caught) {
        setError(messageOf(caught));
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d1a04f]/25 bg-[#111614]/90">
      <header className="flex items-start gap-3 border-b border-white/10 p-4 md:p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#d1a04f]/12 text-[#f3dfae]">
          <LockKeyhole className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-white">Fechamento diário</p>
          <p className="mt-1 text-sm text-[#9a958b]">
            Conferência de {formatShortDate(snapshot.businessDate)}. Os valores esperados vêm das operações e pagamentos reais.
          </p>
        </div>
        {isClosed ? (
          <span className="rounded-full border border-[#4ade80]/25 bg-[#4ade80]/10 px-2.5 py-1 text-xs font-semibold text-[#86efac]">
            Fechado
          </span>
        ) : currentClose ? (
          <span className="rounded-full border border-[#fb923c]/25 bg-[#fb923c]/10 px-2.5 py-1 text-xs font-semibold text-[#fdba74]">
            Reaberto
          </span>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4 md:p-5">
        {[
          ["Entradas", snapshot.expectedIncome, "text-[#86efac]"],
          ["Despesas", snapshot.expectedExpense, "text-[#fca5a5]"],
          ["Prêmios", snapshot.expectedPrize, "text-[#f3dfae]"],
          ["Saldo esperado", snapshot.expectedNet, snapshot.expectedNet >= 0 ? "text-[#93c5fd]" : "text-[#fca5a5]"],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-xl border border-white/8 bg-black/15 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7e786d]">{label}</p>
            <p className={`mt-1 text-base font-bold ${tone}`}>{formatCurrency(Number(value))}</p>
          </div>
        ))}
      </div>

      {isClosed && currentClose ? (
        <div className="space-y-4 border-t border-white/10 p-4 md:p-5">
          <div className="flex gap-3 rounded-xl border border-[#4ade80]/20 bg-[#4ade80]/8 p-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#4ade80]" />
            <div className="text-sm text-[#c9c2b4]">
              <p className="font-semibold text-white">Conferido por {currentClose.closedBy}</p>
              <p className="mt-1">Informado: {formatCurrency(currentClose.countedCash + currentClose.countedPix + currentClose.countedCard + currentClose.countedOther)}</p>
              <p className={currentClose.differenceAmount === 0 ? "text-[#86efac]" : "text-[#fca5a5]"}>
                Diferença: {formatCurrency(currentClose.differenceAmount)}
              </p>
            </div>
          </div>
          <form onSubmit={submitReopen} className="space-y-2">
            <label className="block text-sm font-medium text-[#c9c2b4]" htmlFor="reopen-reason">Motivo para reabrir</label>
            <textarea
              id="reopen-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={5}
              required
              className={`${fieldClass} min-h-24 py-3`}
              placeholder="Explique por que o caixa precisa receber novos lançamentos ou correções."
            />
            <button disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#fb923c]/30 bg-[#fb923c]/10 px-4 text-sm font-semibold text-[#fdba74] disabled:opacity-50">
              <RotateCcw className="size-4" />
              {pending ? "Reabrindo…" : "Reabrir dia"}
            </button>
          </form>
        </div>
      ) : (
        <form onSubmit={submitClose} className="space-y-4 border-t border-white/10 p-4 md:p-5">
          {currentClose?.status === "REOPENED" ? (
            <div className="flex gap-2 rounded-xl border border-[#fb923c]/20 bg-[#fb923c]/8 p-3 text-sm text-[#fdba74]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p>Reaberto por {currentClose.reopenedBy ?? "Dono"}: {currentClose.reopenReason}</p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {([
              ["Dinheiro contado", cash, setCash],
              ["PIX conferido", pix, setPix],
              ["Cartões conferidos", card, setCard],
              ["Outros", other, setOther],
            ] satisfies Array<[string, number, (next: number) => void]>).map(([label, value, setter]) => (
              <label key={label} className="space-y-1.5 text-sm text-[#c9c2b4]">
                <span>{label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={Number(value)}
                  onChange={(event) => setter(Number(event.target.value))}
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
          <div className={`rounded-xl border p-3 ${difference === 0 ? "border-[#4ade80]/20 bg-[#4ade80]/8" : "border-[#f87171]/25 bg-[#f87171]/8"}`}>
            <p className="text-xs uppercase tracking-[0.16em] text-[#9a958b]">Diferença da conferência</p>
            <p className={`mt-1 text-xl font-bold ${difference === 0 ? "text-[#86efac]" : "text-[#fca5a5]"}`}>{formatCurrency(difference)}</p>
          </div>
          <label className="block space-y-1.5 text-sm text-[#c9c2b4]">
            <span>Observações</span>
            <textarea name="notes" className={`${fieldClass} min-h-20 py-3`} placeholder="Explique diferenças ou ocorrências do dia." />
          </label>
          <button disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d1a04f] px-4 text-sm font-bold text-black active:scale-[0.99] disabled:opacity-50">
            <LockKeyhole className="size-4" />
            {pending ? "Fechando…" : "Conferir e fechar o dia"}
          </button>
        </form>
      )}

      {error ? <p className="border-t border-[#f87171]/20 bg-[#f87171]/8 px-4 py-3 text-sm text-[#fca5a5]">{error}</p> : null}
      {success ? <p className="border-t border-[#4ade80]/20 bg-[#4ade80]/8 px-4 py-3 text-sm text-[#86efac]">{success}</p> : null}
    </section>
  );
}
