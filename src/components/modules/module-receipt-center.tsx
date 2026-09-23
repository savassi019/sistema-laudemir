"use client";

import { FilterX, LoaderCircle, ReceiptText, RefreshCw, Search } from "lucide-react";
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

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-[#101412] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <ReceiptText className="size-4 text-[#d1a04f]" />
              Central de comprovantes
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#9a958b]">
              Reabra uma via já salva para baixar o PDF ou enviar novamente ao telefone do cliente.
            </p>
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
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7e786d]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${fieldClass} pl-11`}
            placeholder="Cliente, telefone ou ID do comprovante"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Data inicial" className={`${fieldClass} min-h-11 text-base [color-scheme:dark]`} />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Data final" className={`${fieldClass} min-h-11 text-base [color-scheme:dark]`} />
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={`${fieldClass} min-h-11 text-base`}>
            <option value="">Todos os pagamentos</option>
            {paymentOptions.map((payment) => <option key={payment} value={payment}>{payment}</option>)}
          </select>
          <button type="button" disabled={!hasFilters} onClick={() => { setQuery(""); setFromDate(""); setToDate(""); setPaymentMethod(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-[#c9c2b4] active:bg-white/5 disabled:opacity-40">
            <FilterX className="size-4" /> Limpar
          </button>
        </div>
        <p className="mt-2 text-xs text-[#7e786d]">{filtered.length} de {items.length} comprovantes</p>
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
        <div className="space-y-3">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-[#101412] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-xs text-[#a9a398]">{item.subtitle}</p>
                  <p className="mt-1 text-[11px] font-medium text-[#d1a04f]">{item.receiptCode}</p>
                  <p className="mt-1 text-xs text-[#7e786d]">
                    {formatShortDate(item.occurredAt)}
                    {item.phone ? ` · ${item.phone}` : " · Sem telefone cadastrado"}
                  </p>
                  <p className="mt-1 text-xs text-[#7e786d]">Pagamento: {item.paymentMethod}</p>
                </div>
                <span className="rounded-full border border-[#4ade80]/25 bg-[#4ade80]/10 px-2 py-1 text-[10px] font-semibold text-[#bbf7d0]">
                  Salvo
                </span>
              </div>
              <WhatsAppReceiptButton
                defaultPhone={item.phone}
                closedAt={item.closedAt}
                message={item.message}
                title="Via do cliente — WhatsApp e PDF"
                documentLabel="Via do cliente"
                pdfButtonLabel="Baixar comprovante em PDF"
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
