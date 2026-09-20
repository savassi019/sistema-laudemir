"use client";

import {
  Award,
  CalendarDays,
  LoaderCircle,
  MapPin,
  Printer,
  Search,
  Share2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, rotuloDeStatus } from "@/lib/status-labels";
import { listBxPrizeRecordsAction } from "@/server/actions/module-record-actions";
import type { BxPrizeItem } from "@/server/services/module-record-service";

import { fieldClass, labelClass, selectClass } from "./styles";

type SortKey = "recent" | "oldest" | "highest" | "lowest";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function localDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function paymentLabel(value: string | null) {
  return value ? rotuloDeStatus(value, PAYMENT_METHOD_LABEL) : "Não informado";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reportPeriodLabel(fromDate: string, toDate: string) {
  const formatDate = (value: string) => {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };

  if (fromDate && toDate) return `${formatDate(fromDate)} a ${formatDate(toDate)}`;
  if (fromDate) return `A partir de ${formatDate(fromDate)}`;
  if (toDate) return `Até ${formatDate(toDate)}`;
  return "Todo o período";
}

function buildPrintHtml(
  items: BxPrizeItem[],
  total: number,
  fromDate: string,
  toDate: string,
) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDateTime(item.occurredAt))}</td>
          <td>${escapeHtml(item.clientName)}</td>
          <td>${escapeHtml(item.location || "Não informado")}</td>
          <td>${escapeHtml(item.operatorName)}</td>
          <td>${escapeHtml(paymentLabel(item.paymentMethod))}</td>
          <td class="amount">${escapeHtml(formatCurrency(item.amount))}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório de prêmios da máquina</title>
        <style>
          * { box-sizing: border-box; }
          body { color: #171717; font-family: Arial, sans-serif; margin: 28px; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          .period { color: #555; font-size: 13px; margin-bottom: 20px; }
          .summary { display: flex; gap: 28px; margin-bottom: 20px; }
          .summary strong { display: block; font-size: 18px; margin-top: 3px; }
          .label { color: #666; font-size: 11px; text-transform: uppercase; }
          table { border-collapse: collapse; font-size: 11px; width: 100%; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
          th { background: #f4f1ea; font-size: 10px; text-transform: uppercase; }
          .amount { font-weight: 700; text-align: right; white-space: nowrap; }
          @page { margin: 15mm; size: landscape; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>Relatório de prêmios da máquina</h1>
        <div class="period">${escapeHtml(reportPeriodLabel(fromDate, toDate))}</div>
        <div class="summary">
          <div><span class="label">Operações</span><strong>${items.length}</strong></div>
          <div><span class="label">Total gasto</span><strong>${escapeHtml(formatCurrency(total))}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Data e hora</th><th>Cliente/local</th><th>Endereço</th>
              <th>Funcionário</th><th>Pagamento</th><th class="amount">Valor</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>`;
}

/**
 * Mostra o prêmio da máquina registrado no fechamento
 * normal do BX. Não é um lançamento avulso separado.
 */
export function BxPrizeSection({ hideFinancials = false }: { hideFinancials?: boolean }) {
  const [items, setItems] = useState<BxPrizeItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [operator, setOperator] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    listBxPrizeRecordsAction()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const operators = useMemo(
    () =>
      [...new Set((items ?? []).map((item) => item.operatorName))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [items],
  );

  const paymentMethods = useMemo(
    () =>
      [
        ...new Set(
          (items ?? [])
            .map((item) => item.paymentMethod)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort((a, b) => paymentLabel(a).localeCompare(paymentLabel(b), "pt-BR")),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const result = (items ?? []).filter((item) => {
      const searchable = `${item.clientName} ${item.location} ${item.operatorName}`.toLocaleLowerCase(
        "pt-BR",
      );
      const dateKey = localDateKey(item.occurredAt);

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (!operator || item.operatorName === operator) &&
        (!paymentMethod || item.paymentMethod === paymentMethod) &&
        (!fromDate || dateKey >= fromDate) &&
        (!toDate || dateKey <= toDate)
      );
    });

    result.sort((a, b) => {
      if (sort === "highest") return b.amount - a.amount;
      if (sort === "lowest") return a.amount - b.amount;
      const difference = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      return sort === "oldest" ? -difference : difference;
    });

    return result;
  }, [fromDate, items, operator, paymentMethod, query, sort, toDate]);

  const total = filteredItems.reduce((sum, item) => sum + item.amount, 0);
  const hasFilters = Boolean(query || operator || paymentMethod || fromDate || toDate);

  function clearFilters() {
    setQuery("");
    setOperator("");
    setPaymentMethod("");
    setFromDate("");
    setToDate("");
    setSort("recent");
  }

  function printReport() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setFeedback("O navegador bloqueou a janela de impressão.");
      return;
    }

    printWindow.opener = null;
    printWindow.document.write(buildPrintHtml(filteredItems, total, fromDate, toDate));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function shareReport() {
    const visibleItems = filteredItems.slice(0, 50);
    const lines = visibleItems.map(
      (item) =>
        `${formatDateTime(item.occurredAt)} — ${item.clientName} — ${item.location || "Local não informado"} — ${item.operatorName} — ${paymentLabel(item.paymentMethod)} — ${formatCurrency(item.amount)}`,
    );
    const omitted = filteredItems.length - visibleItems.length;
    const text = [
      "Relatório de prêmios da máquina",
      reportPeriodLabel(fromDate, toDate),
      `${filteredItems.length} operação(ões) — Total: ${formatCurrency(total)}`,
      "",
      ...lines,
      ...(omitted > 0 ? [`... e mais ${omitted} operação(ões).`] : []),
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: "Relatório de prêmios da máquina", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setFeedback("Relatório copiado para compartilhar.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback("Não foi possível compartilhar o relatório.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[#d1a04f]/28 bg-[#3a2b18]/72 p-4 text-sm leading-6 text-[#f3dfae]">
        <p className="font-medium">Prêmios da máquina</p>
        <p>
          Todo prêmio liberado pela máquina aparece aqui automaticamente como despesa da Infinity
          ao fechar a operação.
        </p>
      </div>

      {items && items.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">Buscar e filtrar</h2>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-[#e0b872] active:bg-white/[0.05]"
              >
                <X className="size-4" />
                Limpar
              </button>
            ) : null}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7e786d]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cliente, local ou funcionário"
              className={`${fieldClass} pl-11`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className={labelClass}>Funcionário</span>
              <select
                value={operator}
                onChange={(event) => setOperator(event.target.value)}
                className={selectClass}
              >
                <option value="">Todos</option>
                {operators.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className={labelClass}>Forma de pagamento</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className={selectClass}
              >
                <option value="">Todas</option>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {paymentLabel(method)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className={labelClass}>Data inicial</span>
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => setFromDate(event.target.value)}
                className={`${fieldClass} [color-scheme:dark]`}
              />
            </label>

            <label className="space-y-1.5">
              <span className={labelClass}>Data final</span>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => setToDate(event.target.value)}
                className={`${fieldClass} [color-scheme:dark]`}
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className={labelClass}>Ordenar por</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className={selectClass}
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                {!hideFinancials ? <option value="highest">Maior valor</option> : null}
                {!hideFinancials ? <option value="lowest">Menor valor</option> : null}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {items && items.length > 0 ? (
        <div className="rounded-2xl border border-[#d1a04f]/25 bg-[#241c0e]/70 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              {!hideFinancials ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#e0b872]">
                    Total gasto em prêmios
                  </p>
                  <p className="mt-1 text-xl font-bold text-[#f3dfae]">
                    {formatCurrency(total)}
                  </p>
                </>
              ) : null}
              <p className={`${hideFinancials ? "mt-0" : "mt-1"} text-xs text-[#9a958b]`}>
                {filteredItems.length} de {items.length} operação(ões)
              </p>
            </div>

            {!hideFinancials && filteredItems.length > 0 ? (
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={printReport}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-3 text-sm font-medium text-[#f3dfae] active:bg-[#d1a04f]/20 sm:flex-none"
                >
                  <Printer className="size-4" />
                  Imprimir / PDF
                </button>
                <button
                  type="button"
                  onClick={shareReport}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-white active:bg-white/[0.06] sm:flex-none"
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </button>
              </div>
            ) : null}
          </div>
          {feedback ? <p className="mt-3 text-xs text-[#e0b872]">{feedback}</p> : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Operações com prêmio</h2>
          {items ? (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#c9c2b4]">
              {filteredItems.length}
            </span>
          ) : null}
        </div>

        {!items ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <LoaderCircle className="size-5 animate-spin text-[#9a958b]" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[rgba(245,241,232,0.1)] py-8 text-center">
            <p className="text-sm text-[#5a544c]">Nenhum prêmio da máquina registrado ainda.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[rgba(245,241,232,0.1)] px-4 py-8 text-center">
            <p className="text-sm text-[#9a958b]">Nenhuma operação encontrada com esses filtros.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 min-h-11 rounded-xl px-4 text-sm font-medium text-[#e0b872] active:bg-white/[0.05]"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-[#d1a04f]/20 bg-[#241c0e]/40 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#d1a04f]/15">
                    <Award className="size-4 text-[#e0b872]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-semibold text-white">
                        {item.clientName}
                      </p>
                      {!hideFinancials ? (
                        <span className="shrink-0 text-sm font-bold text-[#f3dfae]">
                          {formatCurrency(item.amount)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 space-y-1.5 text-xs text-[#c9c2b4]">
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#9a958b]" />
                        <span className="break-words">{item.location || "Local não informado"}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-3.5 shrink-0 text-[#9a958b]" />
                        <span>{formatDateTime(item.occurredAt)}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <UserRound className="size-3.5 shrink-0 text-[#9a958b]" />
                        <span className="break-words">{item.operatorName}</span>
                      </p>
                    </div>

                    <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-[#c9c2b4]">
                      {paymentLabel(item.paymentMethod)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
