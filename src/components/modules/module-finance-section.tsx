"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  List,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Share2,
  Table2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  cancelModuleFinancialEntryAction,
  createModuleFinancialEntryAction,
  listModuleFinancialEntriesAction,
  registerModuleFinancialPaymentAction,
  updateModuleFinancialEntryAction,
} from "@/server/actions/finance-actions";
import type {
  ModuleFinancialEntryItem,
  ModuleFinancialStatus,
} from "@/server/services/finance-service";

import { fieldClass, labelClass, selectClass } from "./styles";

const STATUS_LABEL: Record<ModuleFinancialStatus, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Estornado",
};

const STATUS_COLOR: Record<ModuleFinancialStatus, string> = {
  DRAFT: "border-white/15 bg-white/[0.04] text-[#c9c2b4]",
  PENDING: "border-[#c9a84c]/35 bg-[#c9a84c]/10 text-[#f0d98a]",
  PARTIAL: "border-[#7b9fc9]/35 bg-[#7b9fc9]/10 text-[#b8d4f5]",
  PAID: "border-[#6b9d6f]/35 bg-[#6b9d6f]/10 text-[#bfe3c2]",
  OVERDUE: "border-[#b46c5d]/35 bg-[#b46c5d]/10 text-[#f0a08f]",
  CANCELLED: "border-white/10 bg-white/[0.03] text-[#7e786d]",
};

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CASH: "Dinheiro",
  CARTAO: "Cartão",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BANK_TRANSFER: "Transferência",
  BOLETO: "Boleto",
  CHECK: "Cheque",
  ABERTO: "Em aberto",
  OTHER: "Outro / não informado",
};

const PAYMENT_OPTIONS = [
  { value: "PIX", label: "PIX" },
  { value: "CASH", label: "Dinheiro" },
  { value: "CREDIT_CARD", label: "Cartão" },
  { value: "BANK_TRANSFER", label: "Transferência" },
  { value: "OTHER", label: "Outro" },
];

type FilterKey = "todos" | "entradas" | "despesas" | "pendentes";
type ViewMode = "lista" | "semanas" | "meses";

function paymentLabel(value: string | null) {
  return value ? (METHOD_LABEL[value] ?? "Outro") : "Não informado";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getWeekMonday(dateStr: string): Date {
  const date = new Date(dateStr);
  const day = date.getDay();
  const difference = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + difference);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeekLabel(monday: Date): string {
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const format = (date: Date) =>
    `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `Seg ${format(monday)} – Sáb ${format(saturday)}`;
}

function formatMonthLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function periodLabel(from: string, to: string) {
  const format = (value: string) => {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };
  if (from && to) return `${format(from)} a ${format(to)}`;
  if (from) return `A partir de ${format(from)}`;
  if (to) return `Até ${format(to)}`;
  return "Todo o período";
}

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type SummaryTotals = { income: number; expense: number; net: number; pending: number };
type BxTotals = { prize: number; other: number; discount: number; total: number };
type SlotHTotals = { received: number; pending: number; negative: number; net: number };
type MethodTotal = { method: string; label: string; amount: number };

function calculateBxTotals(entries: ModuleFinancialEntryItem[]): BxTotals {
  const expenses = entries.filter(
    (entry) => entry.status !== "CANCELLED" && entry.direction === "EXPENSE",
  );
  const prize = expenses
    .filter((entry) => entry.category === "PRIZE")
    .reduce((sum, entry) => sum + entry.totalAmount, 0);
  const discount = expenses
    .filter((entry) => entry.category === "DISCOUNT")
    .reduce((sum, entry) => sum + entry.totalAmount, 0);
  const other = expenses
    .filter((entry) => entry.category !== "PRIZE" && entry.category !== "DISCOUNT")
    .reduce((sum, entry) => sum + entry.totalAmount, 0);
  return { prize, other, discount, total: prize + other + discount };
}

function calculateSlotHTotals(entries: ModuleFinancialEntryItem[]): SlotHTotals {
  const positiveResults = entries.filter(
    (entry) =>
      entry.status !== "CANCELLED" && entry.category === "SLOT_INFINITY_RESULT",
  );
  const received = positiveResults.reduce((sum, entry) => sum + entry.paidAmount, 0);
  const pending = positiveResults.reduce((sum, entry) => sum + entry.remainingAmount, 0);
  const negative = entries
    .filter(
      (entry) =>
        entry.status !== "CANCELLED" && entry.category === "SLOT_NEGATIVE_RESULT",
    )
    .reduce((sum, entry) => sum + entry.totalAmount, 0);

  return { received, pending, negative, net: received + pending - negative };
}

function calculateMethodTotals(entries: ModuleFinancialEntryItem[]): MethodTotal[] {
  const grouped = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status === "CANCELLED" || entry.direction !== "INCOME" || entry.paidAmount <= 0) {
      continue;
    }
    if (entry.payments.length > 0) {
      for (const payment of entry.payments) {
        grouped.set(payment.method, (grouped.get(payment.method) ?? 0) + payment.amount);
      }
    } else {
      const method = entry.paymentMethod ?? "OTHER";
      grouped.set(method, (grouped.get(method) ?? 0) + entry.paidAmount);
    }
  }
  return [...grouped.entries()]
    .map(([method, amount]) => ({ method, label: paymentLabel(method), amount }))
    .sort((a, b) => b.amount - a.amount);
}

function buildPrintHtml({
  moduleTitle,
  from,
  to,
  entries,
  totals,
  bxTotals,
  slotHTotals,
  methodTotals,
}: {
  moduleTitle: string;
  from: string;
  to: string;
  entries: ModuleFinancialEntryItem[];
  totals: SummaryTotals;
  bxTotals: BxTotals | null;
  slotHTotals: SlotHTotals | null;
  methodTotals: MethodTotal[];
}) {
  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td>${escapeHtml(formatDateTime(entry.createdAt))}</td>
        <td>${escapeHtml(entry.description)}</td>
        <td>${escapeHtml(entry.clientName ?? "-")}</td>
        <td>${entry.origin === "OPERATION" ? "Operação" : "Avulso"}</td>
        <td>${escapeHtml(entry.categoryLabel)}</td>
        <td>${escapeHtml(entry.operatorName ?? "-")}</td>
        <td>${escapeHtml(STATUS_LABEL[entry.status])}</td>
        <td>${escapeHtml(paymentLabel(entry.paymentMethod))}</td>
        <td class="number">${entry.direction === "INCOME" ? "+" : "-"}${escapeHtml(formatCurrency(entry.totalAmount))}</td>
        <td class="number">${escapeHtml(formatCurrency(entry.paidAmount))}</td>
        <td class="number">${escapeHtml(formatCurrency(entry.remainingAmount))}</td>
      </tr>`,
    )
    .join("");

  const methodRows = methodTotals
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.label)}</td><td class="number">${escapeHtml(formatCurrency(item.amount))}</td></tr>`,
    )
    .join("");

  const bxCards = bxTotals
    ? `<div class="cards bx">
        <div class="card"><span>Prêmios</span><strong>${escapeHtml(formatCurrency(bxTotals.prize))}</strong></div>
        <div class="card"><span>Outras despesas</span><strong>${escapeHtml(formatCurrency(bxTotals.other))}</strong></div>
        <div class="card"><span>Descontos</span><strong>${escapeHtml(formatCurrency(bxTotals.discount))}</strong></div>
        <div class="card"><span>Total gasto</span><strong>${escapeHtml(formatCurrency(bxTotals.total))}</strong></div>
      </div>`
    : "";

  const slotHCards = slotHTotals
    ? `<h2>Resultado das máquinas H</h2>
      <div class="cards bx">
        <div class="card"><span>Recebido</span><strong>${escapeHtml(formatCurrency(slotHTotals.received))}</strong></div>
        <div class="card"><span>A receber</span><strong>${escapeHtml(formatCurrency(slotHTotals.pending))}</strong></div>
        <div class="card"><span>Resultado negativo</span><strong>${escapeHtml(formatCurrency(slotHTotals.negative))}</strong></div>
        <div class="card"><span>Saldo das máquinas</span><strong>${escapeHtml(formatCurrency(slotHTotals.net))}</strong></div>
      </div>`
    : "";

  return `<!doctype html>
  <html lang="pt-BR"><head><meta charset="utf-8" />
  <title>${escapeHtml(moduleTitle)} — Financeiro</title>
  <style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171717;margin:24px;font-size:11px}
    h1{font-size:22px;margin:0 0 4px}.sub{color:#666;margin:0 0 18px}.cards{display:flex;gap:10px;margin-bottom:16px}
    .card{border:1px solid #ddd;border-radius:8px;flex:1;padding:10px}.card span{color:#666;display:block;font-size:9px;text-transform:uppercase}
    .card strong{display:block;font-size:16px;margin-top:4px}.bx strong{font-size:13px}h2{font-size:14px;margin:22px 0 8px}
    table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}
    th{background:#f4f1ea;font-size:9px;text-transform:uppercase}.number{text-align:right;white-space:nowrap}.methods{max-width:360px}
    @page{size:landscape;margin:12mm}@media print{body{margin:0}}
  </style></head><body>
    <h1>${escapeHtml(moduleTitle)} — Financeiro</h1>
    <p class="sub">${escapeHtml(periodLabel(from, to))} · ${entries.length} lançamento(ões) · Gerado em ${escapeHtml(new Date().toLocaleDateString("pt-BR"))}</p>
    <div class="cards">
      <div class="card"><span>Entradas</span><strong>${escapeHtml(formatCurrency(totals.income))}</strong></div>
      <div class="card"><span>Despesas</span><strong>${escapeHtml(formatCurrency(totals.expense))}</strong></div>
      <div class="card"><span>Saldo</span><strong>${escapeHtml(formatCurrency(totals.net))}</strong></div>
      <div class="card"><span>Pendente</span><strong>${escapeHtml(formatCurrency(totals.pending))}</strong></div>
    </div>
    ${bxCards}
    ${slotHCards}
    ${methodTotals.length ? `<h2>Entradas por forma de pagamento</h2><table class="methods"><tbody>${methodRows}</tbody></table>` : ""}
    <h2>Lançamentos</h2>
    <table><thead><tr><th>Data</th><th>Descrição</th><th>Cliente/local</th><th>Origem</th><th>Categoria</th><th>Funcionário</th><th>Status</th><th>Pagamento</th><th class="number">Valor</th><th class="number">Pago</th><th class="number">Restante</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </body></html>`;
}

function EntryDetails({
  entry,
  editOpen,
  paymentOpen,
  busy,
  actionError,
  onToggleEdit,
  onTogglePayment,
  onPayment,
  onEdit,
  onCancel,
}: {
  entry: ModuleFinancialEntryItem;
  editOpen: boolean;
  paymentOpen: boolean;
  busy: boolean;
  actionError: string | null;
  onToggleEdit: () => void;
  onTogglePayment: () => void;
  onPayment: (event: React.FormEvent<HTMLFormElement>) => void;
  onEdit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const isManual = entry.origin === "MANUAL";
  const canChange = isManual && entry.status !== "CANCELLED";

  return (
    <div className="border-t border-white/[0.07] px-3 pb-3 pt-3">
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-xl bg-white/[0.025] p-2.5">
          <p className="text-[#7e786d]">Valor original</p>
          <p className="mt-1 font-semibold text-white">{formatCurrency(entry.totalAmount)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.025] p-2.5">
          <p className="text-[#7e786d]">Pago</p>
          <p className="mt-1 font-semibold text-[#bfe3c2]">{formatCurrency(entry.paidAmount)}</p>
        </div>
        <div className="col-span-2 rounded-xl bg-white/[0.025] p-2.5 sm:col-span-1">
          <p className="text-[#7e786d]">Saldo restante</p>
          <p className="mt-1 font-semibold text-[#f0d98a]">
            {formatCurrency(entry.remainingAmount)}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-[#c9c2b4]">
        <p><span className="text-[#7e786d]">Origem:</span> {entry.origin === "OPERATION" ? "Operação automática" : "Lançamento avulso"}</p>
        <p><span className="text-[#7e786d]">Categoria:</span> {entry.categoryLabel}</p>
        {entry.clientName ? <p><span className="text-[#7e786d]">Cliente/local:</span> {entry.clientName}</p> : null}
        {entry.operatorName ? <p><span className="text-[#7e786d]">Funcionário:</span> {entry.operatorName}</p> : null}
        <p><span className="text-[#7e786d]">Forma de pagamento:</span> {paymentLabel(entry.paymentMethod)}</p>
        <p><span className="text-[#7e786d]">Registrado em:</span> {formatDateTime(entry.createdAt)}</p>
        {entry.notes ? <p><span className="text-[#7e786d]">Observação:</span> {entry.notes}</p> : null}
      </div>

      {entry.details.length > 0 ? (
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7e786d]">Dados da operação</p>
          <div className="mt-2 space-y-1 text-xs text-[#c9c2b4]">
            {entry.details.map((detail) => <p key={detail}>{detail}</p>)}
          </div>
        </div>
      ) : null}

      {isManual ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <History className="size-3.5 text-[#9a958b]" />
            <p className="text-xs font-semibold text-white">Histórico de pagamentos</p>
          </div>
          {entry.payments.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {entry.payments.map((payment) => (
                <div key={payment.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-[#bfe3c2]">{formatCurrency(payment.amount)}</span>
                    <span className="text-[#9a958b]">{formatDateTime(payment.paymentDate)}</span>
                  </div>
                  <p className="mt-1 text-[#9a958b]">
                    {paymentLabel(payment.method)} · {payment.createdByName}
                  </p>
                  {payment.notes ? <p className="mt-1 text-[#c9c2b4]">{payment.notes}</p> : null}
                  {payment.proofFileId ? (
                    <a
                      href={`/api/files/${payment.proofFileId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex min-h-11 items-center text-[#e0b872] underline underline-offset-2"
                    >
                      Abrir comprovante
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : entry.paidAmount > 0 ? (
            <p className="mt-2 text-xs text-[#9a958b]">Baixa anterior sem histórico detalhado.</p>
          ) : (
            <p className="mt-2 text-xs text-[#7e786d]">Nenhum pagamento registrado.</p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-[#7b9fc9]/20 bg-[#7b9fc9]/8 p-3 text-xs text-[#b8d4f5]">
          Este lançamento veio da operação e deve ser corrigido no fechamento original.
        </p>
      )}

      {canChange ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.remainingAmount > 0 ? (
            <button
              type="button"
              onClick={onTogglePayment}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#6b9d6f]/30 bg-[#6b9d6f]/10 px-3 text-xs font-semibold text-[#bfe3c2] active:bg-[#6b9d6f]/20"
            >
              <CheckCircle2 className="size-4" /> Registrar pagamento
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleEdit}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-[#c9c2b4] active:bg-white/[0.05]"
          >
            <Pencil className="size-4" /> Corrigir
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#b46c5d]/25 px-3 text-xs font-semibold text-[#f0a08f] active:bg-[#b46c5d]/10"
          >
            <Ban className="size-4" /> Estornar
          </button>
        </div>
      ) : null}

      {paymentOpen ? (
        <form onSubmit={onPayment} className="mt-3 space-y-3 rounded-xl border border-[#6b9d6f]/20 bg-[#0e1c10]/45 p-3">
          <p className="text-xs font-semibold text-white">Registrar pagamento</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className={labelClass}>Valor pago</span>
              <input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" max={entry.remainingAmount} required className={fieldClass} />
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Forma de pagamento</span>
              <select name="paymentMethod" required className={selectClass} defaultValue="PIX">
                {PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className={labelClass}>Observação</span>
            <input name="notes" className={fieldClass} placeholder="Opcional" />
          </label>
          <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-[#6b9d6f] px-4 text-sm font-semibold text-[#071008] disabled:opacity-50">
            {busy ? "Salvando..." : "Confirmar pagamento"}
          </button>
        </form>
      ) : null}

      {editOpen ? (
        <form onSubmit={onEdit} className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <p className="text-xs font-semibold text-white">Corrigir lançamento avulso</p>
          <label className="block space-y-1.5">
            <span className={labelClass}>Descrição</span>
            <input name="description" required defaultValue={entry.description} className={fieldClass} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className={labelClass}>Valor total</span>
              <input name="totalAmount" type="number" inputMode="decimal" step="0.01" min={Math.max(entry.paidAmount, 0.01)} required defaultValue={entry.totalAmount} className={fieldClass} />
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Forma de pagamento</span>
              <select name="paymentMethod" className={selectClass} defaultValue={entry.paymentMethod ?? ""}>
                <option value="">Não informado</option>
                {PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className={labelClass}>Observação</span>
            <input name="notes" defaultValue={entry.notes ?? ""} className={fieldClass} />
          </label>
          <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-[#d1a04f] px-4 text-sm font-semibold text-[#0d0a05] disabled:opacity-50">
            {busy ? "Salvando..." : "Salvar correção"}
          </button>
        </form>
      ) : null}

      {actionError ? <p className="mt-3 text-xs text-[#f0a08f]">{actionError}</p> : null}
    </div>
  );
}

export function ModuleFinanceSection({
  slug,
  moduleTitle,
  initialEntries,
}: {
  slug: string;
  moduleTitle: string;
  initialEntries: ModuleFinancialEntryItem[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [formOpen, setFormOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<"PENDING" | "PARTIAL" | "PAID">("PENDING");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [periodLoading, setPeriodLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const activeEntries = useMemo(
    () => entries.filter((entry) => entry.status !== "CANCELLED"),
    [entries],
  );

  const totals = useMemo<SummaryTotals>(() => {
    const income = activeEntries
      .filter((entry) => entry.direction === "INCOME")
      .reduce((sum, entry) => sum + entry.totalAmount, 0);
    const expense = activeEntries
      .filter((entry) => entry.direction === "EXPENSE")
      .reduce((sum, entry) => sum + entry.totalAmount, 0);
    const pending = activeEntries
      .filter((entry) => ["PENDING", "PARTIAL", "OVERDUE"].includes(entry.status))
      .reduce((sum, entry) => sum + entry.remainingAmount, 0);
    return { income, expense, net: income - expense, pending };
  }, [activeEntries]);

  const bxTotals = useMemo<BxTotals | null>(() => {
    if (slug !== "bx") return null;
    return calculateBxTotals(activeEntries);
  }, [activeEntries, slug]);

  const slotHTotals = useMemo<SlotHTotals | null>(() => {
    if (slug !== "h-caca-niquel") return null;
    return calculateSlotHTotals(activeEntries);
  }, [activeEntries, slug]);

  const methodTotals = useMemo(() => calculateMethodTotals(activeEntries), [activeEntries]);

  const operators = useMemo(
    () => [...new Set(entries.map((entry) => entry.operatorName).filter((name): name is string => Boolean(name && name !== "-")))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [entries],
  );
  const methods = useMemo(
    () =>
      [
        ...new Set(
          entries
            .flatMap((entry) => [entry.paymentMethod, ...entry.payments.map((payment) => payment.method)])
            .filter((method): method is string => Boolean(method)),
        ),
      ].sort((a, b) => paymentLabel(a).localeCompare(paymentLabel(b), "pt-BR")),
    [entries],
  );
  const categories = useMemo(
    () => [...new Map(entries.map((entry) => [entry.category, entry.categoryLabel])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    [entries],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return entries.filter((entry) => {
      const isPendingEntry = ["PENDING", "PARTIAL", "OVERDUE"].includes(entry.status);
      const matchesDirection =
        filter === "todos" ||
        (filter === "entradas" && entry.direction === "INCOME") ||
        (filter === "despesas" && entry.direction === "EXPENSE") ||
        (filter === "pendentes" && isPendingEntry);
      const searchable = [
        entry.description,
        entry.clientName,
        entry.operatorName,
        entry.categoryLabel,
        ...entry.details,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return (
        matchesDirection &&
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (!statusFilter || entry.status === statusFilter) &&
        (!originFilter || entry.origin === originFilter) &&
        (!methodFilter || entry.paymentMethod === methodFilter || entry.payments.some((payment) => payment.method === methodFilter)) &&
        (!categoryFilter || entry.category === categoryFilter) &&
        (!operatorFilter || entry.operatorName === operatorFilter)
      );
    });
  }, [categoryFilter, entries, filter, methodFilter, operatorFilter, originFilter, query, statusFilter]);

  const filteredTotals = useMemo<SummaryTotals>(() => {
    const active = filtered.filter((entry) => entry.status !== "CANCELLED");
    const income = active.filter((entry) => entry.direction === "INCOME").reduce((sum, entry) => sum + entry.totalAmount, 0);
    const expense = active.filter((entry) => entry.direction === "EXPENSE").reduce((sum, entry) => sum + entry.totalAmount, 0);
    const pending = active.filter((entry) => ["PENDING", "PARTIAL", "OVERDUE"].includes(entry.status)).reduce((sum, entry) => sum + entry.remainingAmount, 0);
    return { income, expense, net: income - expense, pending };
  }, [filtered]);

  const weeklyGroups = useMemo(() => {
    const grouped = new Map<string, { monday: Date; income: number; expense: number; count: number }>();
    for (const entry of filtered) {
      if (entry.status === "CANCELLED") continue;
      const monday = getWeekMonday(entry.createdAt);
      const key = monday.toISOString();
      const group = grouped.get(key) ?? { monday, income: 0, expense: 0, count: 0 };
      if (entry.direction === "INCOME") group.income += entry.totalAmount;
      else group.expense += entry.totalAmount;
      group.count += 1;
      grouped.set(key, group);
    }
    return [...grouped.values()].sort((a, b) => b.monday.getTime() - a.monday.getTime());
  }, [filtered]);

  const monthlyGroups = useMemo(() => {
    const grouped = new Map<string, { monthStart: Date; income: number; expense: number; count: number }>();
    for (const entry of filtered) {
      if (entry.status === "CANCELLED") continue;
      const date = new Date(entry.createdAt);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const group = grouped.get(key) ?? { monthStart, income: 0, expense: 0, count: 0 };
      if (entry.direction === "INCOME") group.income += entry.totalAmount;
      else group.expense += entry.totalAmount;
      group.count += 1;
      grouped.set(key, group);
    }
    return [...grouped.values()].sort((a, b) => b.monthStart.getTime() - a.monthStart.getTime());
  }, [filtered]);

  const hasDetailedFilters = Boolean(query || statusFilter || originFilter || methodFilter || categoryFilter || operatorFilter);

  function replaceEntry(updated: ModuleFinancialEntryItem) {
    setEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  }

  function showSaved(message: string) {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setFeedback(message);
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
  }

  function clearDetailedFilters() {
    setQuery("");
    setStatusFilter("");
    setOriginFilter("");
    setMethodFilter("");
    setCategoryFilter("");
    setOperatorFilter("");
    setFilter("todos");
  }

  function handleDateSearch() {
    setPeriodLoading(true);
    setError(null);
    startTransition(async () => {
      try {
        const data = await listModuleFinancialEntriesAction(slug, fromDate || undefined, toDate || undefined);
        setEntries(data);
        setSelectedId(null);
      } catch (caught) {
        setError(getErrorMessage(caught, "Não foi possível buscar esse período."));
      } finally {
        setPeriodLoading(false);
      }
    });
  }

  function clearDates() {
    setFromDate("");
    setToDate("");
    setEntries(initialEntries);
    setSelectedId(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      description: String(data.get("description") ?? "").trim(),
      totalAmount: Number(data.get("totalAmount") ?? 0),
      paidAmount: Number(data.get("paidAmount") ?? 0),
      direction: String(data.get("direction") ?? "INCOME"),
      status: newStatus,
      paymentMethod: String(data.get("paymentMethod") ?? "") || undefined,
      notes: String(data.get("notes") ?? "").trim() || undefined,
    };

    startTransition(async () => {
      try {
        const created = await createModuleFinancialEntryAction(slug, payload);
        setEntries((current) => [created, ...current]);
        setFormOpen(false);
        setNewStatus("PENDING");
        form.reset();
        showSaved("Lançamento salvo com sucesso.");
      } catch (caught) {
        setError(getErrorMessage(caught, "Não foi possível salvar o lançamento."));
      }
    });
  }

  function handlePayment(event: React.FormEvent<HTMLFormElement>, entry: ModuleFinancialEntryItem) {
    event.preventDefault();
    setActionError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        const updated = await registerModuleFinancialPaymentAction(slug, entry.id, {
          amount: Number(data.get("amount") ?? 0),
          paymentMethod: String(data.get("paymentMethod") ?? ""),
          notes: String(data.get("notes") ?? "").trim() || undefined,
        });
        replaceEntry(updated);
        setPaymentId(null);
        showSaved("Pagamento registrado e saldo atualizado.");
      } catch (caught) {
        setActionError(getErrorMessage(caught, "Não foi possível registrar o pagamento."));
      }
    });
  }

  function handleEdit(event: React.FormEvent<HTMLFormElement>, entry: ModuleFinancialEntryItem) {
    event.preventDefault();
    setActionError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const updated = await updateModuleFinancialEntryAction(slug, entry.id, {
          description: String(data.get("description") ?? "").trim(),
          totalAmount: Number(data.get("totalAmount") ?? 0),
          paymentMethod: String(data.get("paymentMethod") ?? "") || null,
          notes: String(data.get("notes") ?? "").trim() || null,
        });
        replaceEntry(updated);
        setEditId(null);
        showSaved("Lançamento corrigido com auditoria.");
      } catch (caught) {
        setActionError(getErrorMessage(caught, "Não foi possível corrigir o lançamento."));
      }
    });
  }

  function handleCancel(entry: ModuleFinancialEntryItem) {
    if (!window.confirm(`Estornar o lançamento “${entry.description}”? O histórico será preservado.`)) return;
    setActionError(null);
    startTransition(async () => {
      try {
        const updated = await cancelModuleFinancialEntryAction(slug, entry.id);
        replaceEntry(updated);
        setEditId(null);
        setPaymentId(null);
        showSaved("Lançamento estornado; o histórico foi preservado.");
      } catch (caught) {
        setActionError(getErrorMessage(caught, "Não foi possível estornar o lançamento."));
      }
    });
  }

  function handlePrint() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setFeedback("O navegador bloqueou a janela de impressão.");
      return;
    }
    printWindow.opener = null;
    printWindow.document.write(
      buildPrintHtml({
        moduleTitle,
        from: fromDate,
        to: toDate,
        entries: filtered,
        totals: filteredTotals,
        bxTotals: slug === "bx" ? calculateBxTotals(filtered) : null,
        slotHTotals:
          slug === "h-caca-niquel" ? calculateSlotHTotals(filtered) : null,
        methodTotals: calculateMethodTotals(filtered),
      }),
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function handleCsv() {
    const header = ["Data", "Descrição", "Cliente/local", "Origem", "Categoria", "Funcionário", "Status", "Pagamento", "Direção", "Valor", "Pago", "Restante"];
    const rows = filtered.map((entry) => [
      formatDateTime(entry.createdAt),
      entry.description,
      entry.clientName ?? "",
      entry.origin === "OPERATION" ? "Operação" : "Avulso",
      entry.categoryLabel,
      entry.operatorName ?? "",
      STATUS_LABEL[entry.status],
      paymentLabel(entry.paymentMethod),
      entry.direction === "INCOME" ? "Entrada" : "Despesa",
      entry.totalAmount.toFixed(2).replace(".", ","),
      entry.paidAmount.toFixed(2).replace(".", ","),
      entry.remainingAmount.toFixed(2).replace(".", ","),
    ]);
    const csv = `\ufeff${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `financeiro-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleShare() {
    const visible = filtered.slice(0, 40);
    const sharedBxTotals = slug === "bx" ? calculateBxTotals(filtered) : null;
    const sharedSlotHTotals =
      slug === "h-caca-niquel" ? calculateSlotHTotals(filtered) : null;
    const lines = visible.map((entry) => `${formatShortDate(entry.createdAt)} — ${entry.description} — ${entry.categoryLabel} — ${entry.direction === "INCOME" ? "+" : "-"}${formatCurrency(entry.totalAmount)}`);
    const text = [
      `${moduleTitle} — Financeiro`,
      periodLabel(fromDate, toDate),
      `Entradas: ${formatCurrency(filteredTotals.income)}`,
      `Despesas: ${formatCurrency(filteredTotals.expense)}`,
      `Saldo: ${formatCurrency(filteredTotals.net)}`,
      ...(sharedBxTotals ? [`Prêmios: ${formatCurrency(sharedBxTotals.prize)}`, `Outras despesas: ${formatCurrency(sharedBxTotals.other)}`, `Descontos: ${formatCurrency(sharedBxTotals.discount)}`] : []),
      ...(sharedSlotHTotals
        ? [
            `H recebido: ${formatCurrency(sharedSlotHTotals.received)}`,
            `H a receber: ${formatCurrency(sharedSlotHTotals.pending)}`,
            `H resultado negativo: ${formatCurrency(sharedSlotHTotals.negative)}`,
            `H saldo das máquinas: ${formatCurrency(sharedSlotHTotals.net)}`,
          ]
        : []),
      "",
      ...lines,
      ...(filtered.length > visible.length ? [`... e mais ${filtered.length - visible.length} lançamento(ões).`] : []),
    ].join("\n");

    try {
      if (navigator.share) await navigator.share({ title: `${moduleTitle} — Financeiro`, text });
      else {
        await navigator.clipboard.writeText(text);
        setFeedback("Relatório copiado para compartilhar.");
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setFeedback("Não foi possível compartilhar o relatório.");
    }
  }

  const filterTabs: { key: FilterKey; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "entradas", label: "Entradas" },
    { key: "despesas", label: "Despesas" },
    { key: "pendentes", label: "Pendentes" },
  ];
  const incomeDescription =
    slug === "h-caca-niquel"
      ? "Resultado da Infinity e entradas avulsas"
      : slug === "bx"
        ? "Operações recebidas e entradas avulsas"
        : "Valores registrados como entrada";
  const expenseDescription =
    slug === "h-caca-niquel"
      ? "Resultados negativos e despesas avulsas"
      : slug === "bx"
        ? "Prêmios, gastos e descontos"
        : "Valores registrados como despesa";

  return (
    <div className="space-y-4">
      {saved ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-[#6b9d6f]/30 bg-[#0e1c10]/80 px-4 py-3 text-sm font-medium text-[#bfe3c2]">
          <CheckCircle2 className="size-4 shrink-0" /> {feedback}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/[0.08] bg-[#0b0f0e]/35 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="size-4 text-[#9a958b]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9a958b]">Filtrar por período</p>
          <div className="ml-auto flex gap-1.5">
            <button type="button" onClick={handlePrint} disabled={filtered.length === 0} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-semibold text-[#c9c2b4] disabled:opacity-40">
              <Printer className="size-4" /> PDF
            </button>
            <button type="button" onClick={handleCsv} disabled={filtered.length === 0} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-semibold text-[#c9c2b4] disabled:opacity-40">
              <Download className="size-4" /> Planilha
            </button>
            <button type="button" onClick={handleShare} disabled={filtered.length === 0} className="flex size-11 items-center justify-center rounded-xl border border-white/10 text-[#c9c2b4] disabled:opacity-40" title="Compartilhar">
              <Share2 className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className={`${fieldClass} [color-scheme:dark]`} />
          <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className={`${fieldClass} [color-scheme:dark]`} />
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={handleDateSearch} disabled={periodLoading} className="min-h-11 flex-1 rounded-xl bg-[#d1a04f] px-4 text-sm font-semibold text-[#0d0a05] disabled:opacity-50">
            {periodLoading ? <LoaderCircle className="mx-auto size-4 animate-spin" /> : "Buscar"}
          </button>
          {fromDate || toDate ? <button type="button" onClick={clearDates} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-[#c9c2b4]">Limpar</button> : null}
        </div>
        {error ? <p className="mt-2 text-xs text-[#f0a08f]">{error}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 border-l-4 border-l-[#4ade80] bg-[#111513] p-4">
          <div className="flex items-center gap-2 text-[#d7ded9]"><TrendingUp className="size-4 text-[#4ade80]" /><p className="text-xs font-semibold uppercase tracking-[0.12em]">Entradas</p></div>
          <p className="mt-2 break-words text-xl font-bold text-white">{formatCurrency(totals.income)}</p>
          <p className="mt-1 text-[11px] text-[#8f9992]">{incomeDescription}</p>
        </article>
        <article className="rounded-2xl border border-white/10 border-l-4 border-l-[#fb7185] bg-[#111513] p-4">
          <div className="flex items-center gap-2 text-[#d7ded9]"><TrendingDown className="size-4 text-[#fb7185]" /><p className="text-xs font-semibold uppercase tracking-[0.12em]">Despesas</p></div>
          <p className="mt-2 break-words text-xl font-bold text-white">{formatCurrency(totals.expense)}</p>
          <p className="mt-1 text-[11px] text-[#8f9992]">{expenseDescription}</p>
        </article>
        <article className={cn("rounded-2xl border border-white/10 border-l-4 bg-[#111513] p-4", totals.net >= 0 ? "border-l-[#60a5fa]" : "border-l-[#f87171]")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#d7ded9]"><Wallet className={cn("size-4", totals.net >= 0 ? "text-[#60a5fa]" : "text-[#f87171]")} /><p className="text-xs font-semibold uppercase tracking-[0.12em]">Saldo</p></div>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", totals.net >= 0 ? "bg-[#60a5fa]/12 text-[#93c5fd]" : "bg-[#f87171]/12 text-[#fca5a5]")}>{totals.net >= 0 ? "Positivo" : "Negativo"}</span>
          </div>
          <p className={cn("mt-2 break-words text-xl font-bold", totals.net >= 0 ? "text-[#93c5fd]" : "text-[#fca5a5]")}>{formatCurrency(totals.net)}</p>
          <p className="mt-1 text-[11px] text-[#8f9992]">Entradas menos despesas</p>
        </article>
      </div>

      {bxTotals ? (
        <div className="rounded-2xl border border-white/10 bg-[#101412] p-4">
          <p className="text-sm font-semibold text-white">De onde vieram as despesas</p>
          <p className="mt-1 text-xs text-[#8f9992]">Separação dos valores registrados no BX</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 border-l-4 border-l-[#fbbf24] bg-[#151a17] p-3">
              <p className="text-xs font-medium text-[#c5cdc7]">Prêmios</p>
              <p className="mt-1 text-base font-bold text-white">{formatCurrency(bxTotals.prize)}</p>
            </div>
            <div className="rounded-xl border border-white/10 border-l-4 border-l-[#fb923c] bg-[#151a17] p-3">
              <p className="text-xs font-medium text-[#c5cdc7]">Outras despesas</p>
              <p className="mt-1 text-base font-bold text-white">{formatCurrency(bxTotals.other)}</p>
            </div>
            <div className="rounded-xl border border-white/10 border-l-4 border-l-[#a78bfa] bg-[#151a17] p-3">
              <p className="text-xs font-medium text-[#c5cdc7]">Descontos</p>
              <p className="mt-1 text-base font-bold text-white">{formatCurrency(bxTotals.discount)}</p>
            </div>
            <div className="rounded-xl border border-[#f87171]/30 border-l-4 border-l-[#f87171] bg-[#171313] p-3">
              <p className="text-xs font-semibold text-[#fca5a5]">Total gasto</p>
              <p className="mt-1 text-base font-bold text-white">{formatCurrency(bxTotals.total)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {slotHTotals ? (
        <div className="rounded-2xl border border-white/10 bg-[#101412] p-4">
          <p className="text-sm font-semibold text-white">Resultado das máquinas H</p>
          <p className="mt-1 text-xs text-[#8f9992]">
            Somente os fechamentos das máquinas; lançamentos avulsos ficam nos totais acima
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 border-l-4 border-l-[#4ade80] bg-[#151a17] p-3">
              <p className="text-xs font-medium text-[#c5cdc7]">Recebido</p>
              <p className="mt-1 text-base font-bold text-white">
                {formatCurrency(slotHTotals.received)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 border-l-4 border-l-[#fbbf24] bg-[#151a17] p-3">
              <p className="text-xs font-medium text-[#c5cdc7]">A receber</p>
              <p className="mt-1 text-base font-bold text-white">
                {formatCurrency(slotHTotals.pending)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 border-l-4 border-l-[#fb7185] bg-[#151a17] p-3">
              <p className="text-xs font-medium text-[#c5cdc7]">Resultado negativo</p>
              <p className="mt-1 text-base font-bold text-white">
                {formatCurrency(slotHTotals.negative)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-xl border border-white/10 border-l-4 bg-[#151a17] p-3",
                slotHTotals.net >= 0 ? "border-l-[#60a5fa]" : "border-l-[#f87171]",
              )}
            >
              <p className="text-xs font-semibold text-[#c5cdc7]">Saldo das máquinas</p>
              <p
                className={cn(
                  "mt-1 text-base font-bold",
                  slotHTotals.net >= 0 ? "text-[#bfdbfe]" : "text-[#fca5a5]",
                )}
              >
                {formatCurrency(slotHTotals.net)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {methodTotals.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#101412] p-4">
          <p className="text-sm font-semibold text-white">Como o dinheiro entrou</p>
          <p className="mt-1 text-xs text-[#8f9992]">Somente valores recebidos, separados por pagamento</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {methodTotals.map((item) => (
              <div key={item.method} className="rounded-xl border border-white/10 border-l-4 border-l-[#4ade80] bg-[#151a17] p-3">
                <p className="text-xs font-medium text-[#c5cdc7]">{item.label}</p>
                <p className="mt-1 text-base font-bold text-white">{formatCurrency(item.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/[0.08] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-white">Lançamento avulso</h2><p className="mt-0.5 text-xs text-[#9a958b]">Entrada ou despesa que não veio de uma operação.</p></div>
          <button type="button" onClick={() => setFormOpen((current) => !current)} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#d1a04f] px-3 text-xs font-semibold text-[#0d0a05]">
            {formOpen ? <X className="size-4" /> : <Plus className="size-4" />} {formOpen ? "Cancelar" : "Novo"}
          </button>
        </div>
        {formOpen ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
            <label className="block space-y-1.5"><span className={labelClass}>Descrição</span><input name="description" required className={fieldClass} placeholder="Ex: custo de material" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5"><span className={labelClass}>Tipo</span><select name="direction" className={selectClass} defaultValue="INCOME"><option value="INCOME">Entrada</option><option value="EXPENSE">Despesa</option></select></label>
              <label className="space-y-1.5"><span className={labelClass}>Valor total</span><input name="totalAmount" type="number" inputMode="decimal" step="0.01" min="0.01" required className={fieldClass} /></label>
              <label className="space-y-1.5"><span className={labelClass}>Situação</span><select name="status" value={newStatus} onChange={(event) => setNewStatus(event.target.value as typeof newStatus)} className={selectClass}><option value="PENDING">Pendente</option><option value="PARTIAL">Parcial</option><option value="PAID">Pago</option></select></label>
              {newStatus === "PARTIAL" ? <label className="space-y-1.5"><span className={labelClass}>Valor já pago</span><input name="paidAmount" type="number" inputMode="decimal" step="0.01" min="0.01" required className={fieldClass} /></label> : null}
              <label className="space-y-1.5"><span className={labelClass}>Forma de pagamento</span><select name="paymentMethod" required={newStatus !== "PENDING"} className={selectClass} defaultValue=""><option value="">Não informado</option>{PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <label className="block space-y-1.5"><span className={labelClass}>Observação</span><input name="notes" className={fieldClass} placeholder="Opcional" /></label>
            <button type="submit" disabled={isPending} className="min-h-11 w-full rounded-xl bg-[#d1a04f] px-4 text-sm font-semibold text-[#0d0a05] disabled:opacity-50">{isPending ? "Salvando..." : "Salvar lançamento"}</button>
          </form>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0b0f0e]/35 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-white">Lançamentos</h2><span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-[#c9c2b4]">{filtered.length}</span></div>
          <div className="flex overflow-hidden rounded-xl border border-white/10">
            {(["lista", "semanas", "meses"] as ViewMode[]).map((mode) => {
              const Icon = mode === "lista" ? List : mode === "semanas" ? CalendarDays : Table2;
              return <button key={mode} type="button" onClick={() => setViewMode(mode)} title={mode === "lista" ? "Lista" : mode === "semanas" ? "Semanas" : "Meses"} className={cn("flex size-11 items-center justify-center border-l border-white/10 first:border-l-0", viewMode === mode ? "bg-[#d1a04f]/20 text-[#f3dfae]" : "text-[#9a958b]")}><Icon className="size-4" /></button>;
            })}
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7e786d]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${fieldClass} pl-11`} placeholder="Cliente, local, funcionário ou descrição" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {filterTabs.map((tab) => <button key={tab.key} type="button" onClick={() => setFilter(tab.key)} className={cn("min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold", filter === tab.key ? "border-[#d1a04f]/50 bg-[#d1a04f]/15 text-[#f3dfae]" : "border-white/10 text-[#9a958b]")}>{tab.label}</button>)}
          </div>
          <button type="button" onClick={() => setFiltersOpen((current) => !current)} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-[#c9c2b4]">
            Filtros {filtersOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>

        {filtersOpen ? (
          <div className="mt-3 grid gap-3 rounded-xl border border-white/[0.07] bg-black/10 p-3 sm:grid-cols-2">
            <label className="space-y-1.5"><span className={labelClass}>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}><option value="">Todos</option>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-1.5"><span className={labelClass}>Origem</span><select value={originFilter} onChange={(event) => setOriginFilter(event.target.value)} className={selectClass}><option value="">Todas</option><option value="OPERATION">Operação automática</option><option value="MANUAL">Lançamento avulso</option></select></label>
            <label className="space-y-1.5"><span className={labelClass}>Forma de pagamento</span><select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} className={selectClass}><option value="">Todas</option>{methods.map((method) => <option key={method} value={method}>{paymentLabel(method)}</option>)}</select></label>
            <label className="space-y-1.5"><span className={labelClass}>Categoria</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={selectClass}><option value="">Todas</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-1.5 sm:col-span-2"><span className={labelClass}>Funcionário</span><select value={operatorFilter} onChange={(event) => setOperatorFilter(event.target.value)} className={selectClass}><option value="">Todos</option>{operators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select></label>
            {hasDetailedFilters || filter !== "todos" ? <button type="button" onClick={clearDetailedFilters} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-[#e0b872] sm:col-span-2">Limpar todos os filtros</button> : null}
          </div>
        ) : null}

        {viewMode === "lista" ? (
          filtered.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-[#7e786d]">Nenhum lançamento encontrado.</div> : (
            <div className="mt-3 space-y-2">
              {filtered.map((entry) => {
                const isIncome = entry.direction === "INCOME";
                const expanded = selectedId === entry.id;
                return (
                  <article key={entry.id} className={cn("overflow-hidden rounded-xl border border-l-4 bg-[#111513]", entry.status === "CANCELLED" ? "border-white/[0.07] border-l-[#6b7280] opacity-70" : isIncome ? "border-white/10 border-l-[#4ade80]" : "border-white/10 border-l-[#fb7185]")}>
                    <button type="button" onClick={() => { setSelectedId(expanded ? null : entry.id); setEditId(null); setPaymentId(null); setActionError(null); }} className="flex min-h-[72px] w-full items-center gap-3 p-3 text-left">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                        {isIncome ? <ArrowDownLeft className="size-4 text-[#4ade80]" /> : <ArrowUpRight className="size-4 text-[#fb7185]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("break-words text-sm font-medium text-white", entry.status === "CANCELLED" && "line-through")}>{entry.description}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[#c9c2b4]">{entry.origin === "OPERATION" ? "Operação" : "Avulso"}</span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[#c9c2b4]">{entry.categoryLabel}</span>
                          <span className={cn("rounded-full border px-2 py-0.5 font-semibold", STATUS_COLOR[entry.status])}>{STATUS_LABEL[entry.status]}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#9a958b]">{formatShortDate(entry.createdAt)}{entry.operatorName ? ` · ${entry.operatorName}` : ""}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-white">{isIncome ? "+" : "-"}{formatCurrency(entry.totalAmount)}</p>
                        {entry.remainingAmount > 0 ? <p className="mt-1 text-[10px] text-[#f0d98a]">Resta {formatCurrency(entry.remainingAmount)}</p> : null}
                        {expanded ? <ChevronUp className="ml-auto mt-1 size-4 text-[#7e786d]" /> : <ChevronDown className="ml-auto mt-1 size-4 text-[#7e786d]" />}
                      </div>
                    </button>
                    {expanded ? <EntryDetails entry={entry} editOpen={editId === entry.id} paymentOpen={paymentId === entry.id} busy={isPending} actionError={actionError} onToggleEdit={() => { setEditId(editId === entry.id ? null : entry.id); setPaymentId(null); setActionError(null); }} onTogglePayment={() => { setPaymentId(paymentId === entry.id ? null : entry.id); setEditId(null); setActionError(null); }} onPayment={(event) => handlePayment(event, entry)} onEdit={(event) => handleEdit(event, entry)} onCancel={() => handleCancel(entry)} /> : null}
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <div className="mt-3 space-y-2">
            {(viewMode === "semanas" ? weeklyGroups.map((group) => ({ key: group.monday.toISOString(), label: formatWeekLabel(group.monday), ...group })) : monthlyGroups.map((group) => ({ key: group.monthStart.toISOString(), label: formatMonthLabel(group.monthStart), ...group }))).map((group) => {
              const net = group.income - group.expense;
              return <div key={group.key} className="rounded-xl border border-white/[0.08] bg-black/10 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold capitalize text-[#c9c2b4]">{group.label}</p><p className="mt-1 text-[10px] text-[#7e786d]">{group.count} lançamento(ões)</p></div><p className={cn("text-sm font-bold", net >= 0 ? "text-[#bfe3c2]" : "text-[#f0a08f]")}>{net >= 0 ? "+" : ""}{formatCurrency(net)}</p></div><div className="mt-2 flex gap-4 text-xs"><span className="text-[#8cc490]">Entradas {formatCurrency(group.income)}</span><span className="text-[#d4806f]">Despesas {formatCurrency(group.expense)}</span></div></div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
