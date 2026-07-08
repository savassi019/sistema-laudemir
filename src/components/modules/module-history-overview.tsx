"use client";

import { ChevronDown, ChevronUp, Inbox, LoaderCircle, WalletCards } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { listModuleClientRecordsAction } from "@/server/actions/module-record-actions";
import type { ModuleClientItem, ModuleRecordItem } from "@/server/services/module-record-service";

export function ModuleHistoryOverview({
  slug,
  clients,
  hideFinancials = false,
}: {
  slug: string;
  clients: ModuleClientItem[];
  hideFinancials?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordsMap, setRecordsMap] = useState<Record<string, ModuleRecordItem[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function toggleExpand(client: ModuleClientItem) {
    if (expandedId === client.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(client.id);

    if (!recordsMap[client.id]) {
      setLoadingId(client.id);
      listModuleClientRecordsAction(slug, client.id, client.name)
        .then((records) => setRecordsMap((prev) => ({ ...prev, [client.id]: records })))
        .catch(() => setRecordsMap((prev) => ({ ...prev, [client.id]: [] })))
        .finally(() => setLoadingId(null));
    }
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,241,232,0.14)] bg-white/[0.02] px-4 py-8 text-center">
        <Inbox className="mb-3 size-7 text-[#5a544c]" />
        <p className="text-sm text-[#9a958b]">Nenhum cliente cadastrado ainda.</p>
      </div>
    );
  }

  return (
    <section className="space-y-2">
      {clients.map((client) => {
        const expanded = expandedId === client.id;
        const records = recordsMap[client.id] ?? [];

        return (
          <article
            key={client.id}
            className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-white/[0.025] p-3.5"
          >
            <button
              type="button"
              onClick={() => toggleExpand(client)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{client.name}</p>
                {client.subtitle ? (
                  <p className="mt-0.5 truncate text-xs text-[#9a958b]">{client.subtitle}</p>
                ) : null}
                {client.phone ? (
                  <p className="mt-0.5 text-[11px] text-[#5a544c]">{client.phone}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {client.badge ? (
                  <span className="rounded-full border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-2 py-1 text-[11px] font-medium text-[#f3dfae]">
                    {client.badge}
                  </span>
                ) : null}
                {expanded ? (
                  <ChevronUp className="size-4 text-[#9a958b]" />
                ) : (
                  <ChevronDown className="size-4 text-[#9a958b]" />
                )}
              </div>
            </button>

            {client.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#9a958b]">
                {client.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}

            {expanded ? (
              <div className="mt-3 border-t border-[rgba(245,241,232,0.08)] pt-3">
                {loadingId === client.id ? (
                  <div className="flex items-center gap-2 text-xs text-[#9a958b]">
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Carregando histórico...
                  </div>
                ) : records.length === 0 ? (
                  <p className="text-xs text-[#5a544c]">Nenhum registro encontrado para este cliente.</p>
                ) : (
                  <div className="space-y-2">
                    {records.map((record) => (
                      <RecordCard key={record.id} record={record} hideFinancials={hideFinancials} />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function RecordCard({
  record,
  hideFinancials,
}: {
  record: ModuleRecordItem;
  hideFinancials: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
          <WalletCards className="size-3.5 text-[#d1a04f]" />
          {formatShortDate(record.createdAt)}
        </p>
        {record.badge ? (
          <span className="text-xs text-[#9a958b]">{record.badge}</span>
        ) : null}
      </div>

      {!hideFinancials ? (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {(record.incomeValue ?? 0) > 0 ? (
            <span className="text-[#bfe3c2]">Entrada: {formatCurrency(record.incomeValue ?? 0)}</span>
          ) : null}
          {(record.expenseValue ?? 0) > 0 ? (
            <span className="text-[#f0a08f]">Despesa: {formatCurrency(record.expenseValue ?? 0)}</span>
          ) : null}
          {record.amount ? (
            <span className="font-medium text-[#dbe6d4]">Resultado: {record.amount}</span>
          ) : null}
        </div>
      ) : null}

      {record.details.length > 0 ? (
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-[#9a958b] sm:grid-cols-3">
          {record.details.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
