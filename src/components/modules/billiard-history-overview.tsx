"use client";

import { ChevronDown, ChevronUp, Inbox, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  listBilliardClientsOverviewAction,
  listBilliardPointHistoryAction,
} from "@/server/actions/billiard-route-actions";
import type {
  BilliardClientOverviewItem,
  BilliardPointHistoryEntry,
} from "@/server/services/billiard-route-service";
import { BilliardPointHistoryList } from "./billiard-point-history-list";

export function BilliardHistoryOverview({ hideFinancials = false }: { hideFinancials?: boolean }) {
  const [clients, setClients] = useState<BilliardClientOverviewItem[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, BilliardPointHistoryEntry[]>>({});
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);

  useEffect(() => {
    listBilliardClientsOverviewAction()
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  function toggleExpand(pointId: string) {
    if (expandedId === pointId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(pointId);

    if (!history[pointId]) {
      setLoadingHistoryId(pointId);
      listBilliardPointHistoryAction(pointId)
        .then((entries) => setHistory((current) => ({ ...current, [pointId]: entries })))
        .catch(() => setHistory((current) => ({ ...current, [pointId]: [] })))
        .finally(() => setLoadingHistoryId(null));
    }
  }

  if (clients === null) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[rgba(245,241,232,0.14)] bg-white/[0.02] px-4 py-8 text-sm text-[#9a958b]">
        <LoaderCircle className="size-4 animate-spin" />
        Carregando histórico...
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,241,232,0.14)] bg-white/[0.02] px-4 py-8 text-center">
        <Inbox className="mb-3 size-7 text-[#5a544c]" />
        <p className="text-sm text-[#9a958b]">Nenhum ponto cadastrado ainda.</p>
      </div>
    );
  }

  return (
    <section className="space-y-2">
      {clients.map((client) => {
        const expanded = expandedId === client.id;
        const hasDebt = client.roofOpenDebt > 0;
        const hasPayable = client.accountsPayable > 0;

        return (
          <article
            key={client.id}
            className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-white/[0.025] p-3.5"
          >
            <button
              type="button"
              onClick={() => toggleExpand(client.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {client.registrationNumber ? `#${String(client.registrationNumber).padStart(3, "0")} ` : ""}
                  {client.clientName || client.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#9a958b]">
                  {client.name}
                  {client.phone ? ` · ${client.phone}` : ""}
                </p>
                {client.lastCollectionAt ? (
                  <p className="mt-0.5 text-[11px] text-[#5a544c]">
                    Última coleta: {formatShortDate(client.lastCollectionAt)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-[#5a544c]">Sem coletas ainda</p>
                )}
              </div>
              {expanded ? (
                <ChevronUp className="size-4 shrink-0 text-[#9a958b]" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-[#9a958b]" />
              )}
            </button>

            {!hideFinancials ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                    hasDebt
                      ? "border-[#f87171]/30 bg-[#f87171]/10 text-[#f3a8a8]"
                      : "border-white/10 bg-white/[0.03] text-[#9a958b]"
                  }`}
                >
                  Dívida (telhado): {formatCurrency(client.roofOpenDebt)}
                </span>
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                    hasPayable
                      ? "border-[#d1a04f]/30 bg-[#d1a04f]/10 text-[#f3dfae]"
                      : "border-white/10 bg-white/[0.03] text-[#9a958b]"
                  }`}
                >
                  Contas a pagar: {formatCurrency(client.accountsPayable)}
                </span>
              </div>
            ) : null}

            {expanded ? (
              <div className="mt-3 border-t border-[rgba(245,241,232,0.08)] pt-3">
                {loadingHistoryId === client.id ? (
                  <div className="flex items-center gap-2 text-xs text-[#9a958b]">
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Carregando histórico completo...
                  </div>
                ) : (
                  <BilliardPointHistoryList entries={history[client.id] ?? []} hideFinancials={hideFinancials} />
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
