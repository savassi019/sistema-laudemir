"use client";

import { ChevronDown, ChevronUp, Inbox, LoaderCircle, Search, WalletCards, CalendarDays } from "lucide-react";
import { useState } from "react";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { listModuleClientRecordsAction, listModuleRecordsAction } from "@/server/actions/module-record-actions";
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
  const [query, setQuery]         = useState("");
  const [fromDate, setFromDate]   = useState("");
  const [toDate, setToDate]       = useState("");
  const [flatRecords, setFlatRecords]       = useState<ModuleRecordItem[] | null>(null);
  const [flatLoading, setFlatLoading]       = useState(false);
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [recordsMap, setRecordsMap]         = useState<Record<string, ModuleRecordItem[]>>({});
  const [loadingId, setLoadingId]           = useState<string | null>(null);

  const hasDateFilter = fromDate || toDate;

  const filteredClients = query.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.subtitle?.toLowerCase().includes(query.toLowerCase()),
      )
    : clients;

  function handleDateSearch() {
    if (!fromDate && !toDate) {
      setFlatRecords(null);
      return;
    }
    setFlatLoading(true);
    setFlatRecords(null);
    listModuleRecordsAction(slug, fromDate || undefined, toDate || undefined, 50)
      .then(setFlatRecords)
      .catch(() => setFlatRecords([]))
      .finally(() => setFlatLoading(false));
  }

  function clearDates() {
    setFromDate("");
    setToDate("");
    setFlatRecords(null);
  }

  function toggleExpand(client: ModuleClientItem) {
    if (expandedId === client.id) { setExpandedId(null); return; }
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
    <section className="space-y-3">

      {/* Filtro por data */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <CalendarDays className="size-3.5 text-[#9a958b]" />
          <p className="text-xs font-semibold text-[#9a958b] uppercase tracking-wide">Filtrar por período</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="flex-1 rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-[#d1a04f]/40 [color-scheme:dark]"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="flex-1 rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-[#d1a04f]/40 [color-scheme:dark]"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleDateSearch}
            disabled={flatLoading}
            className="flex-1 rounded-xl bg-[#d1a04f] py-2 text-xs font-semibold text-[#0d0a05] transition hover:bg-[#daa855] disabled:opacity-50"
          >
            {flatLoading ? "Buscando…" : "Buscar"}
          </button>
          {hasDateFilter ? (
            <button
              type="button"
              onClick={clearDates}
              className="rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-2 text-xs text-[#9a958b] transition hover:text-white"
            >
              Limpar
            </button>
          ) : null}
        </div>
      </div>

      {/* Resultado do filtro de data */}
      {hasDateFilter && flatRecords !== null ? (
        <div className="space-y-2">
          {flatRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,241,232,0.14)] bg-white/[0.02] px-4 py-8 text-center">
              <Inbox className="mb-3 size-7 text-[#5a544c]" />
              <p className="text-sm text-[#9a958b]">Nenhum registro no período selecionado.</p>
            </div>
          ) : (
            flatRecords.map((r) => (
              <RecordCard key={r.id} record={r} hideFinancials={hideFinancials} showTitle />
            ))
          )}
        </div>
      ) : !hasDateFilter ? (
        <>
          {/* Busca por cliente */}
          {clients.length > 4 ? (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-[#5a544c]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-white outline-none placeholder:text-[#5a544c] focus:border-[#d1a04f]/40 focus:ring-1 focus:ring-[#d1a04f]/20"
              />
            </div>
          ) : null}

          {/* Lista de clientes (accordion) */}
          {filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,241,232,0.14)] bg-white/[0.02] px-4 py-8 text-center">
              <Inbox className="mb-3 size-7 text-[#5a544c]" />
              <p className="text-sm text-[#9a958b]">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            filteredClients.map((client) => {
              const expanded = expandedId === client.id;
              const records  = recordsMap[client.id] ?? [];
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
                      {client.subtitle ? <p className="mt-0.5 truncate text-xs text-[#9a958b]">{client.subtitle}</p> : null}
                      {client.phone   ? <p className="mt-0.5 text-[11px] text-[#5a544c]">{client.phone}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {client.badge ? (
                        <span className="rounded-full border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-2 py-1 text-[11px] font-medium text-[#f3dfae]">
                          {client.badge}
                        </span>
                      ) : null}
                      {expanded ? <ChevronUp className="size-4 text-[#9a958b]" /> : <ChevronDown className="size-4 text-[#9a958b]" />}
                    </div>
                  </button>

                  {client.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#9a958b]">
                      {client.tags.map((tag) => <span key={tag}>{tag}</span>)}
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
                        <p className="text-xs text-[#5a544c]">Nenhum registro encontrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {records.map((r) => <RecordCard key={r.id} record={r} hideFinancials={hideFinancials} />)}
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </>
      ) : null}
    </section>
  );
}

function RecordCard({
  record,
  hideFinancials,
  showTitle = false,
}: {
  record: ModuleRecordItem;
  hideFinancials: boolean;
  showTitle?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <WalletCards className="size-3.5 text-[#d1a04f]" />
          <p className="text-sm font-medium text-white">{formatShortDate(record.createdAt)}</p>
          {showTitle ? <span className="text-xs text-[#9a958b]">— {record.title}</span> : null}
        </div>
        {record.badge ? <span className="text-xs text-[#9a958b]">{record.badge}</span> : null}
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
          {record.details.map((d) => <span key={d}>{d}</span>)}
        </div>
      ) : null}
    </div>
  );
}
