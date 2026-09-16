"use client";

import { Award, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, rotuloDeStatus } from "@/lib/status-labels";
import { listBxPrizeRecordsAction } from "@/server/actions/module-record-actions";
import type { BxPrizeItem } from "@/server/services/module-record-service";

/**
 * So mostra o que ja foi registrado no fechamento normal do BX com
 * "Situacao do recebimento" = Premio -- nao e um lancamento avulso
 * separado (isso foi tentado e revertido a pedido do dono do projeto).
 */
export function BxPrizeSection({ hideFinancials = false }: { hideFinancials?: boolean }) {
  const [items, setItems] = useState<BxPrizeItem[] | null>(null);

  useEffect(() => {
    listBxPrizeRecordsAction()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const total = items?.reduce((s, i) => s + i.amount, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[#d1a04f]/28 bg-[#3a2b18]/72 p-4 text-sm leading-6 text-[#f3dfae]">
        <p className="font-medium">Prêmios pagos</p>
        <p>
          Toda operação fechada com Situação do recebimento = Prêmio aparece
          aqui automaticamente.
        </p>
      </div>

      {!hideFinancials && items && items.length > 0 ? (
        <div className="rounded-2xl border border-[#d1a04f]/25 bg-[#241c0e]/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#e0b872]">
            Total pago em prêmios
          </p>
          <p className="mt-1 text-base font-bold text-[#f3dfae]">{formatCurrency(total)}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Operações com prêmio</h2>
          {items ? (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#c9c2b4]">
              {items.length}
            </span>
          ) : null}
        </div>

        {!items ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <LoaderCircle className="size-5 animate-spin text-[#9a958b]" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[rgba(245,241,232,0.1)] py-8 text-center">
            <p className="text-sm text-[#5a544c]">Nenhuma operação marcada como Prêmio ainda.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 overflow-hidden rounded-xl border border-[#d1a04f]/20 bg-[#241c0e]/40 py-3 pl-3 pr-4"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#d1a04f]/15">
                  <Award className="size-4 text-[#e0b872]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{item.clientName}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#9a958b]">
                    <span>{formatShortDate(item.occurredAt)}</span>
                    <span>·</span>
                    <span>{item.operatorName}</span>
                    {item.paymentMethod ? (
                      <>
                        <span>·</span>
                        <span>{rotuloDeStatus(item.paymentMethod, PAYMENT_METHOD_LABEL)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                {hideFinancials ? null : (
                  <span className="shrink-0 text-sm font-bold text-[#f3dfae]">
                    {formatCurrency(item.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
