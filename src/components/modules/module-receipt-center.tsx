"use client";

import { ChevronDown, FilterX, LoaderCircle, ReceiptText, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatShortDate } from "@/lib/format";
import { listModuleReceiptsAction } from "@/server/actions/module-record-actions";
import type { ModuleReceiptItem } from "@/server/services/module-receipt-service";

import { fieldClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

export function ModuleReceiptCenter({ slug }: { slug: string }) {
  const [items, setItems] = useState<ModuleReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await listModuleReceiptsAction(slug));
    } catch {
      setError("Não foi possível carregar os comprovantes agora.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Carregamento inicial da secao; a funcao tambem e reutilizada pelo botao Atualizar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
    return items.filter((item) => {
      const haystack = `${item.title} ${item.subtitle} ${item.phone} ${item.receiptCode} ${item.message}`
        .toLocaleLowerCase("pt-BR");
      const occurredAt = new Date(item.occurredAt);
      return (
        (!normalized || haystack.includes(normalized)) &&
        (!from || occurredAt >= from) &&
        (!to || occurredAt <= to) &&
        (!paymentMethod || item.paymentMethod === paymentMethod)
      );
    });
  }, [fromDate, items, paymentMethod, query, toDate]);

  const paymentOptions = useMemo(
    () => [...new Set(items.map((item) => item.paymentMethod).filter(Boolean))].sort(),
    [items],
  );
  const hasFilters = Boolean(query || fromDate || toDate || paymentMethod);
  const advancedFilterCount = [fromDate, toDate, paymentMethod].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-[#101412] p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <ReceiptText className="size-4 text-[#d1a04f]" />
              Comprovantes
            </h2>
            <p className="mt-0.5 text-xs text-[#7e786d]">{items.length} vias salvas</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[#c9c2b4] active:bg-white/5 disabled:opacity-50"
            aria-label="Atualizar comprovantes"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7e786d]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${fieldClass} pl-11`}
              placeholder="Buscar comprovante"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            className={`relative flex size-12 shrink-0 items-center justify-center rounded-xl border active:bg-white/5 ${showFilters || advancedFilterCount > 0 ? "border-[#d1a04f]/35 bg-[#d1a04f]/10 text-[#f3dfae]" : "border-white/10 text-[#9a958b]"}`}
            aria-label="Filtros por data e pagamento"
          >
            <SlidersHorizontal className="size-4" />
            {advancedFilterCount > 0 ? <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#d1a04f] text-[10px] font-bold text-black">{advancedFilterCount}</span> : null}
          </button>
        </div>
        {showFilters ? (
          <div className="mt-2 rounded-xl border border-white/[0.07] bg-black/10 p-2.5">
            <p className="mb-2 text-[11px] font-medium text-[#9a958b]">Período e pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Data inicial" className={`${fieldClass} min-h-11 text-base [color-scheme:dark]`} />
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Data final" className={`${fieldClass} min-h-11 text-base [color-scheme:dark]`} />
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={`${fieldClass} col-span-2 min-h-11 text-base`}>
                <option value="">Todos os pagamentos</option>
                {paymentOptions.map((payment) => <option key={payment} value={payment}>{payment}</option>)}
              </select>
            </div>
          </div>
        ) : null}
        {hasFilters ? (
          <div className="mt-2 flex items-center justify-between gap-3 px-1">
            <p className="text-xs text-[#7e786d]">{filtered.length} encontrados</p>
            <button type="button" onClick={() => { setQuery(""); setFromDate(""); setToDate(""); setPaymentMethod(""); }} className="inline-flex min-h-11 items-center gap-1.5 px-1 text-xs text-[#c9c2b4] active:text-white">
              <FilterX className="size-3.5" /> Limpar filtros
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-[#9a958b]">
          <LoaderCircle className="mr-2 size-4 animate-spin" /> Carregando comprovantes...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-[#fb7185]/30 bg-[#2b1519]/70 p-4 text-sm text-[#fecdd3]">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-[#7e786d]">
          Nenhum comprovante encontrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101412]">
          {filtered.map((item) => (
            <article key={item.id} className="border-b border-white/[0.07] last:border-b-0">
              <button
                type="button"
                onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}
                aria-expanded={expandedId === item.id}
                className="flex min-h-[74px] w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.04]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#d1a04f]/10 text-[#d1a04f]">
                  <ReceiptText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-[#9a958b]">{item.subtitle}</p>
                  <p className="mt-1 text-[11px] text-[#6f6a61]">{formatShortDate(item.occurredAt)} · {item.paymentMethod}</p>
                </div>
                <ChevronDown className={`size-4 shrink-0 text-[#7e786d] transition-transform ${expandedId === item.id ? "rotate-180" : ""}`} />
              </button>
              {expandedId === item.id ? (
                <div className="border-t border-white/[0.07] bg-black/10 p-3">
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-[#7e786d]">
                    <span>{item.receiptCode}</span>
                    <span>{item.phone || "Sem telefone cadastrado"}</span>
                  </div>
                  <WhatsAppReceiptButton
                    compact
                    defaultPhone={item.phone}
                    closedAt={item.closedAt}
                    message={item.message}
                    title="Via do cliente — WhatsApp e PDF"
                    documentLabel="Via do cliente"
                    pdfButtonLabel="PDF"
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
