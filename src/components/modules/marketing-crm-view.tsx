"use client";

import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import {
  addMarketingContentAction,
  deleteMarketingContentAction,
  getMarketingClientsAction,
  updateMarketingChecklistAction,
  updateMarketingClientAction,
  updateMarketingContentStatusAction,
  updateMarketingPipelineAction,
  type MarketingClientDetail,
  type MarketingContentDetail,
  type OnboardingChecklist,
} from "@/server/actions/marketing-actions";
import type { MarketingContentStatus, MarketingPipelineStage } from "@prisma/client";

import { MarketingContractForm } from "./marketing-contract-form";
import { labelClass } from "./styles";

// ─── constants ────────────────────────────────────────────────────────────────

const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const POSTIT_COLORS = [
  { bg: "#FFD93D", text: "#1a1200", sub: "#5c4800", bar: "rgba(0,0,0,0.28)" },
  { bg: "#FF6B6B", text: "#fff",    sub: "rgba(255,255,255,0.72)", bar: "rgba(255,255,255,0.35)" },
  { bg: "#6BCB77", text: "#0d1f10", sub: "#1a4a20", bar: "rgba(0,0,0,0.28)" },
  { bg: "#4D96FF", text: "#fff",    sub: "rgba(255,255,255,0.72)", bar: "rgba(255,255,255,0.35)" },
  { bg: "#FF9F45", text: "#1a0800", sub: "#4a2000", bar: "rgba(0,0,0,0.28)" },
  { bg: "#C77DFF", text: "#fff",    sub: "rgba(255,255,255,0.72)", bar: "rgba(255,255,255,0.35)" },
  { bg: "#FF6FAE", text: "#fff",    sub: "rgba(255,255,255,0.72)", bar: "rgba(255,255,255,0.35)" },
  { bg: "#00C9A7", text: "#003325", sub: "#004d38", bar: "rgba(0,0,0,0.28)" },
];

function clientColorIdx(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return Math.abs(h) % POSTIT_COLORS.length;
}

const PIPELINE_STAGES: {
  key: MarketingPipelineStage;
  label: string;
  short: string;
  textCls: string;
  borderCls: string;
  bgCls: string;
}[] = [
  { key: "LEAD",             label: "Lead",             short: "Lead",    textCls: "text-[#9a958b]",   borderCls: "border-[#9a958b]/30",   bgCls: "bg-[#9a958b]/10"   },
  { key: "CONTACTED",        label: "Contato realizado", short: "Contato", textCls: "text-[#60a5fa]",   borderCls: "border-[#60a5fa]/30",   bgCls: "bg-[#60a5fa]/10"   },
  { key: "MEETING_SCHEDULED",label: "Reunião agendada",  short: "Reunião", textCls: "text-[#f3dfae]",   borderCls: "border-[#d1a04f]/30",   bgCls: "bg-[#d1a04f]/10"   },
  { key: "PROPOSAL_SENT",    label: "Proposta enviada",  short: "Proposta",textCls: "text-[#a89ee0]",   borderCls: "border-[#7b6fc0]/30",   bgCls: "bg-[#7b6fc0]/10"   },
  { key: "NEGOTIATION",      label: "Negociação",        short: "Negoc.",  textCls: "text-[#fb923c]",   borderCls: "border-[#fb923c]/30",   bgCls: "bg-[#fb923c]/10"   },
  { key: "CLOSED",           label: "Fechado",           short: "Fechado", textCls: "text-[#c8bef5]",   borderCls: "border-[#7b6fc0]/50",   bgCls: "bg-[#7b6fc0]/15"   },
  { key: "ACTIVE_CLIENT",    label: "Cliente ativo",     short: "Ativo",   textCls: "text-[#4ade80]",   borderCls: "border-[#4ade80]/30",   bgCls: "bg-[#4ade80]/10"   },
];

const CHECKLIST_ITEMS: { key: keyof OnboardingChecklist; label: string }[] = [
  { key: "contractSigned",      label: "Contrato assinado"       },
  { key: "paymentConfirmed",    label: "Pagamento confirmado"    },
  { key: "strategicDiagnosis",  label: "Diagnóstico estratégico" },
  { key: "logoReceived",        label: "Logotipo recebido"       },
  { key: "photosVideosReceived",label: "Fotos e vídeos enviados" },
  { key: "socialMediaAccess",   label: "Acesso a redes sociais"  },
  { key: "competitorsDefined",  label: "Concorrentes definidos"  },
  { key: "objectivesDefined",   label: "Objetivos definidos"     },
  { key: "contentInspirations", label: "Inspirações de conteúdo" },
];

const CONTENT_STATUS: Record<MarketingContentStatus, { label: string; textCls: string; borderCls: string; bgCls: string }> = {
  PENDING:  { label: "Pendente",  textCls: "text-[#f87171]", borderCls: "border-[#f87171]/25", bgCls: "bg-[#f87171]/8"  },
  PRODUCED: { label: "Produzido", textCls: "text-[#f3dfae]", borderCls: "border-[#d1a04f]/25", bgCls: "bg-[#d1a04f]/8"  },
  APPROVED: { label: "Aprovado",  textCls: "text-[#4ade80]", borderCls: "border-[#4ade80]/25", bgCls: "bg-[#4ade80]/10" },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function stageInfo(key: MarketingPipelineStage) {
  return PIPELINE_STAGES.find((s) => s.key === key) ?? PIPELINE_STAGES[0];
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isOverdue(contentDate: string): boolean {
  const d = new Date(contentDate);
  d.setHours(0, 0, 0, 0);
  return d < todayMidnight();
}

function isDueSoon(contentDate: string, daysAhead = 3): boolean {
  const d = new Date(contentDate);
  d.setHours(0, 0, 0, 0);
  const today = todayMidnight();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysAhead);
  return d >= today && d <= cutoff;
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function generateMonthlyReport(client: MarketingClientDetail) {
  const start = new Date(client.contractDate);
  const now = new Date();
  const rows: { key: string; label: string; income: number; expense: number; net: number }[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cur <= endMonth) {
    rows.push({
      key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[cur.getMonth()]}/${String(cur.getFullYear()).slice(2)}`,
      income: client.contractValue,
      expense: client.expenseAmount,
      net: client.contractValue - client.expenseAmount,
    });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return rows.reverse();
}

// ─── styles ───────────────────────────────────────────────────────────────────

const fieldCls =
  "w-full rounded-xl border border-[rgba(245,241,232,0.12)] bg-[#0b0f0e]/60 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-[#5a544c] focus:outline-none focus:ring-1 focus:ring-[#7b6fc0]/50";

const sectionTitle =
  "mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]";

// ─── ContentAlerts ────────────────────────────────────────────────────────────

type AlertItem = {
  contentId: string;
  title: string;
  clientName: string;
  contentDate: string;
  kind: "overdue" | "soon";
};

function ContentAlerts({ clients }: { clients: MarketingClientDetail[] }) {
  const [open, setOpen] = useState(true);
  const alerts: AlertItem[] = clients
    .flatMap((c) =>
      c.contents
        .filter((cnt) => cnt.status === "PENDING")
        .filter((cnt) => isOverdue(cnt.contentDate) || isDueSoon(cnt.contentDate))
        .map((cnt) => ({
          contentId: cnt.id,
          title: cnt.title,
          clientName: c.name,
          contentDate: cnt.contentDate,
          kind: isOverdue(cnt.contentDate) ? ("overdue" as const) : ("soon" as const),
        })),
    )
    .sort((a, b) => new Date(a.contentDate).getTime() - new Date(b.contentDate).getTime());

  if (alerts.length === 0) return null;

  const overdueCount = alerts.filter((a) => a.kind === "overdue").length;
  const soonCount = alerts.filter((a) => a.kind === "soon").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/40">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-white/[0.02]"
      >
        <Bell className="size-3.5 shrink-0 text-[#f87171]" />
        <p className="flex-1 text-sm font-semibold text-white">
          {overdueCount > 0 && (
            <span className="text-[#f87171]">
              {overdueCount} atrasado{overdueCount !== 1 ? "s" : ""}
            </span>
          )}
          {overdueCount > 0 && soonCount > 0 && <span className="text-[#9a958b]"> · </span>}
          {soonCount > 0 && (
            <span className="text-[#fb923c]">
              {soonCount} vence{soonCount !== 1 ? "m" : ""} em breve
            </span>
          )}
        </p>
        {open ? <ChevronUp className="size-3.5 shrink-0 text-[#9a958b]" /> : <ChevronDown className="size-3.5 shrink-0 text-[#9a958b]" />}
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-[rgba(245,241,232,0.06)] px-3.5 pb-3 pt-2">
          {alerts.map((a) => (
            <div
              key={a.contentId}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
                a.kind === "overdue"
                  ? "border-[#f87171]/15 bg-[#f87171]/5"
                  : "border-[#fb923c]/15 bg-[#fb923c]/5",
              )}
            >
              <AlertTriangle
                className={cn("size-3 shrink-0", a.kind === "overdue" ? "text-[#f87171]" : "text-[#fb923c]")}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">{a.title}</p>
                <p className="text-[10px] text-[#9a958b]">{a.clientName}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[11px] font-medium",
                  a.kind === "overdue" ? "text-[#f87171]" : "text-[#fb923c]",
                )}
              >
                {fmtShortDate(a.contentDate)}
                {a.kind === "overdue" ? " · atrasado" : " · em breve"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PostItCard ───────────────────────────────────────────────────────────────

function PostItCard({
  client,
  selected,
  onClick,
}: {
  client: MarketingClientDetail;
  selected: boolean;
  onClick: () => void;
}) {
  const color = POSTIT_COLORS[clientColorIdx(client.id)];
  const stage = stageInfo(client.pipelineStage);
  const checklist = client.onboardingChecklist;
  const checklistDone = CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
  const hasOverdue = client.contents.some((c) => c.status === "PENDING" && isOverdue(c.contentDate));
  const hasDueSoon = client.contents.some((c) => c.status === "PENDING" && isDueSoon(c.contentDate));

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: color.bg }}
      className={cn(
        "relative flex flex-col rounded-2xl p-3 text-left transition-all duration-200",
        "shadow-[0_4px_16px_rgba(0,0,0,0.35)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
        "hover:-translate-y-0.5 active:scale-95",
        selected
          ? "ring-[3px] ring-white/80 scale-[1.02] shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
          : "",
      )}
    >
      {/* Alert dot */}
      {hasOverdue ? (
        <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-[#f87171] shadow-[0_0_6px_#f87171]" />
      ) : hasDueSoon ? (
        <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-[#fb923c] shadow-[0_0_6px_#fb923c]" />
      ) : null}

      {/* Initials */}
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.15)",
          color: color.text,
        }}
        className="mb-2.5 flex size-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
      >
        {initials(client.name)}
      </div>

      {/* Name */}
      <p
        style={{ color: color.text }}
        className="line-clamp-2 flex-1 text-sm font-bold leading-tight"
      >
        {client.name}
      </p>

      {/* Service type */}
      <p
        style={{ color: color.sub }}
        className="mt-0.5 line-clamp-1 text-[10px] font-medium"
      >
        {client.serviceType}
      </p>

      {/* Stage pill */}
      <div className="mt-2 flex items-center justify-between gap-1">
        <span
          style={{
            backgroundColor: "rgba(0,0,0,0.16)",
            color: color.text,
          }}
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
        >
          {stage.short}
        </span>
        <span style={{ color: color.sub }} className="text-[9px] font-medium">
          {checklistDone}/{CHECKLIST_ITEMS.length}
        </span>
      </div>

      {/* Checklist progress bar */}
      <div
        style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
        className="mt-1.5 h-1 overflow-hidden rounded-full"
      >
        <div
          style={{
            width: `${(checklistDone / CHECKLIST_ITEMS.length) * 100}%`,
            backgroundColor: color.bar,
          }}
          className="h-full rounded-full transition-all"
        />
      </div>
    </button>
  );
}

// ─── AddContentForm ────────────────────────────────────────────────────────────

function AddContentForm({
  contractId,
  onAdded,
  onCancel,
}: {
  contractId: string;
  onAdded: (item: MarketingContentDetail) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<MarketingContentStatus>("PENDING");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const item = await addMarketingContentAction(contractId, title.trim(), date, status);
    onAdded(item);
    setSaving(false);
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-[#7b6fc0]/20 bg-[#7b6fc0]/5 p-3">
      <input
        className={fieldCls}
        placeholder="Descrição do conteúdo…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <input
          type="date"
          className={cn(fieldCls, "flex-1")}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select
          className={cn(fieldCls, "flex-1")}
          value={status}
          onChange={(e) => setStatus(e.target.value as MarketingContentStatus)}
        >
          <option value="PENDING">Pendente</option>
          <option value="PRODUCED">Produzido</option>
          <option value="APPROVED">Aprovado</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex-1 rounded-xl bg-[#7b6fc0] py-2 text-xs font-semibold text-white transition hover:bg-[#8a7fd4] disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="mx-auto size-3.5 animate-spin" /> : "Salvar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[rgba(245,241,232,0.1)] px-4 py-2 text-xs text-[#9a958b] transition hover:text-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── EditClientForm ───────────────────────────────────────────────────────────

function EditClientForm({
  client,
  hideFinancials,
  onSave,
  onCancel,
}: {
  client: MarketingClientDetail;
  hideFinancials: boolean;
  onSave: (updates: Partial<MarketingClientDetail>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone ?? "");
  const [serviceType, setServiceType] = useState(client.serviceType);
  const [contractValue, setContractValue] = useState(String(client.contractValue));
  const [expenseAmount, setExpenseAmount] = useState(String(client.expenseAmount));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const updates = {
      name: name.trim(),
      phone: phone.trim() || null,
      serviceType: serviceType.trim(),
      contractValue: Number(contractValue) || 0,
      expenseAmount: Number(expenseAmount) || 0,
    };
    await updateMarketingClientAction(client.id, updates);
    onSave(updates);
    setSaving(false);
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#7b6fc0]/20 bg-[#7b6fc0]/5 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className={labelClass}>Nome</label>
          <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Telefone</label>
          <input
            className={fieldCls}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Tipo de serviço</label>
          <input
            className={fieldCls}
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
          />
        </div>
        {!hideFinancials && (
          <>
            <div className="space-y-1">
              <label className={labelClass}>Valor mensal (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={fieldCls}
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Custo mensal (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={fieldCls}
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 rounded-xl bg-[#7b6fc0] py-2 text-xs font-semibold text-white transition hover:bg-[#8a7fd4] disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="mx-auto size-3.5 animate-spin" /> : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[rgba(245,241,232,0.1)] px-3 py-2 text-xs text-[#9a958b] transition hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── ClientDetailPanel ────────────────────────────────────────────────────────

function ClientDetailPanel({
  client,
  hideFinancials,
  onUpdate,
  onClose,
}: {
  client: MarketingClientDetail;
  hideFinancials: boolean;
  onUpdate: (patch: Partial<MarketingClientDetail> & { id: string }) => void;
  onClose: () => void;
}) {
  const color = POSTIT_COLORS[clientColorIdx(client.id)];
  const [isEditing, setIsEditing] = useState(false);
  const [addingContent, setAddingContent] = useState(false);
  const [pendingChecklist, setPendingChecklist] = useState<OnboardingChecklist | null>(null);

  const checklist = pendingChecklist ?? client.onboardingChecklist;
  const checklistDone = CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
  const monthlyReport = generateMonthlyReport(client);
  const totalIncome = monthlyReport.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthlyReport.reduce((s, m) => s + m.expense, 0);
  const totalNet = monthlyReport.reduce((s, m) => s + m.net, 0);
  const profit = client.contractValue - client.expenseAmount;

  async function handleStageChange(newStage: MarketingPipelineStage) {
    await updateMarketingPipelineAction(client.id, newStage);
    onUpdate({ id: client.id, pipelineStage: newStage });
  }

  async function handleChecklistToggle(key: keyof OnboardingChecklist) {
    const next = { ...checklist, [key]: !checklist[key] };
    setPendingChecklist(next);
    await updateMarketingChecklistAction(client.id, next);
    onUpdate({ id: client.id, onboardingChecklist: next });
  }

  async function handleContentStatusChange(contentId: string, status: MarketingContentStatus) {
    await updateMarketingContentStatusAction(contentId, status);
    onUpdate({
      id: client.id,
      contents: client.contents.map((c) => (c.id === contentId ? { ...c, status } : c)),
    });
  }

  async function handleDeleteContent(contentId: string) {
    await deleteMarketingContentAction(contentId);
    onUpdate({ id: client.id, contents: client.contents.filter((c) => c.id !== contentId) });
  }

  function handleContentAdded(item: MarketingContentDetail) {
    onUpdate({ id: client.id, contents: [item, ...client.contents] });
    setAddingContent(false);
  }

  function handleEditSave(updates: Partial<MarketingClientDetail>) {
    onUpdate({ id: client.id, ...updates });
    setIsEditing(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.08)] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Colored header */}
      <div
        style={{ backgroundColor: color.bg }}
        className="relative px-4 py-4"
      >
        <button
          type="button"
          onClick={onClose}
          style={{ backgroundColor: "rgba(0,0,0,0.18)", color: color.text }}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-xl transition hover:opacity-70"
        >
          <X className="size-3.5" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div
            style={{ backgroundColor: "rgba(0,0,0,0.18)", color: color.text }}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-bold"
          >
            {initials(client.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p style={{ color: color.text }} className="text-base font-bold leading-tight">
              {client.name}
            </p>
            <p style={{ color: color.sub }} className="text-xs font-medium">
              {client.serviceType}
              {client.phone ? ` · ${client.phone}` : ""}
            </p>
          </div>
        </div>

        {/* Checklist mini bar */}
        <div className="mt-3">
          <div
            style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
            className="h-1.5 overflow-hidden rounded-full"
          >
            <div
              style={{
                width: `${(checklistDone / CHECKLIST_ITEMS.length) * 100}%`,
                backgroundColor: color.bar,
              }}
              className="h-full rounded-full transition-all"
            />
          </div>
          <p style={{ color: color.sub }} className="mt-1 text-[10px] font-medium">
            Onboarding {checklistDone}/{CHECKLIST_ITEMS.length}
          </p>
        </div>
      </div>

      {/* Dark body */}
      <div className="space-y-4 bg-[#0b0f0e]/80 px-4 pb-4 pt-4">
        {/* Edit toggle */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsEditing((x) => !x)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-[#9a958b] transition hover:border-[rgba(245,241,232,0.2)] hover:text-white"
          >
            <Pencil className="size-3" />
            {isEditing ? "Cancelar" : "Editar cliente"}
          </button>
        </div>

        {isEditing && (
          <EditClientForm
            client={client}
            hideFinancials={hideFinancials}
            onSave={handleEditSave}
            onCancel={() => setIsEditing(false)}
          />
        )}

        {/* Pipeline stage */}
        <div>
          <p className={sectionTitle}>Etapa do pipeline</p>
          <div className="flex flex-wrap gap-1.5">
            {PIPELINE_STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => handleStageChange(s.key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                  client.pipelineStage === s.key
                    ? cn(s.textCls, s.borderCls, s.bgCls, "ring-1 ring-current/30")
                    : "border-[rgba(245,241,232,0.1)] text-[#9a958b] hover:border-[rgba(245,241,232,0.2)] hover:text-white",
                )}
              >
                {s.short}
              </button>
            ))}
          </div>
        </div>

        {/* Onboarding checklist */}
        <div>
          <p className={sectionTitle}>Onboarding · {checklistDone}/{CHECKLIST_ITEMS.length}</p>
          <div className="space-y-0.5">
            {CHECKLIST_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleChecklistToggle(item.key)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-md border transition",
                    checklist[item.key]
                      ? "border-[#7b6fc0] bg-[#7b6fc0] text-white"
                      : "border-[rgba(245,241,232,0.2)]",
                  )}
                >
                  {checklist[item.key] && <Check className="size-2.5" />}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    checklist[item.key] ? "text-[#9a958b] line-through" : "text-[#c9c2b4]",
                  )}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Contents */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className={sectionTitle}>Conteúdos</p>
            <button
              type="button"
              onClick={() => setAddingContent((x) => !x)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#7b6fc0]/15 px-2 py-1 text-[10px] font-semibold text-[#c8bef5] transition hover:bg-[#7b6fc0]/25"
            >
              <Plus className="size-3" />
              Novo
            </button>
          </div>

          {addingContent && (
            <AddContentForm
              contractId={client.id}
              onAdded={handleContentAdded}
              onCancel={() => setAddingContent(false)}
            />
          )}

          {client.contents.length === 0 && !addingContent ? (
            <p className="py-1 text-xs text-[#5a544c]">Nenhum conteúdo registrado ainda.</p>
          ) : (
            <div className="mt-1 space-y-1.5">
              {client.contents.map((cnt) => {
                const st = CONTENT_STATUS[cnt.status];
                const overdue = cnt.status === "PENDING" && isOverdue(cnt.contentDate);
                const soon = cnt.status === "PENDING" && isDueSoon(cnt.contentDate);
                return (
                  <div
                    key={cnt.id}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-2.5 py-2",
                      overdue
                        ? "border-[#f87171]/15 bg-[#f87171]/5"
                        : soon
                          ? "border-[#fb923c]/15 bg-[#fb923c]/5"
                          : "border-[rgba(245,241,232,0.06)] bg-white/[0.02]",
                    )}
                  >
                    <span className="shrink-0 text-[11px] text-[#9a958b]">
                      {fmtShortDate(cnt.contentDate)}
                    </span>
                    {overdue ? (
                      <AlertTriangle className="size-3 shrink-0 text-[#f87171]" />
                    ) : soon ? (
                      <AlertTriangle className="size-3 shrink-0 text-[#fb923c]" />
                    ) : null}
                    <p className="min-w-0 flex-1 truncate text-xs text-white">{cnt.title}</p>
                    <select
                      value={cnt.status}
                      onChange={(e) =>
                        handleContentStatusChange(cnt.id, e.target.value as MarketingContentStatus)
                      }
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "shrink-0 rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold [appearance:none] [color-scheme:dark] focus:outline-none",
                        st.textCls, st.borderCls, "bg-transparent",
                      )}
                    >
                      <option value="PENDING">Pendente</option>
                      <option value="PRODUCED">Produzido</option>
                      <option value="APPROVED">Aprovado</option>
                    </select>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleDeleteContent(cnt.id); }}
                      className="shrink-0 rounded-lg p-1 text-[#5a544c] transition hover:text-[#f87171]"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly report */}
        {!hideFinancials && monthlyReport.length > 0 && (
          <div>
            <p className={sectionTitle}>Histórico mensal</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px] text-xs">
                <thead>
                  <tr className="border-b border-[rgba(245,241,232,0.08)]">
                    <th className="pb-2 pr-3 text-left font-medium text-[#9a958b]">Mês</th>
                    <th className="pb-2 pr-3 text-right font-medium text-[#9a958b]">Entrada</th>
                    <th className="pb-2 pr-3 text-right font-medium text-[#9a958b]">Custo</th>
                    <th className="pb-2 text-right font-medium text-[#9a958b]">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyReport.map((m) => (
                    <tr key={m.key} className="border-b border-[rgba(245,241,232,0.04)] last:border-b-0">
                      <td className="py-1.5 pr-3 text-white">{m.label}</td>
                      <td className="py-1.5 pr-3 text-right text-[#4ade80]">{fmt(m.income)}</td>
                      <td className="py-1.5 pr-3 text-right text-[#f87171]">{fmt(m.expense)}</td>
                      <td className={cn("py-1.5 text-right font-medium", m.net < 0 ? "text-[#f87171]" : "text-[#60a5fa]")}>
                        {fmt(m.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[rgba(245,241,232,0.1)]">
                    <td className="pt-2 pr-3 font-semibold text-[#9a958b]">
                      Total ({monthlyReport.length} {monthlyReport.length === 1 ? "mês" : "meses"})
                    </td>
                    <td className="pt-2 pr-3 text-right font-semibold text-[#4ade80]">{fmt(totalIncome)}</td>
                    <td className="pt-2 pr-3 text-right font-semibold text-[#f87171]">{fmt(totalExpense)}</td>
                    <td className={cn("pt-2 text-right font-semibold", totalNet < 0 ? "text-[#f87171]" : "text-[#60a5fa]")}>
                      {fmt(totalNet)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Financial summary */}
        {!hideFinancials && (
          <div className="rounded-xl border border-[rgba(245,241,232,0.06)] bg-white/[0.02] p-3">
            <p className={sectionTitle}>Financeiro mensal</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-[#9a958b]">Entrada</p>
                <p className="font-semibold text-[#4ade80]">{fmt(client.contractValue)}</p>
              </div>
              <div>
                <p className="text-[#9a958b]">Custo</p>
                <p className="font-semibold text-[#f87171]">{fmt(client.expenseAmount)}</p>
              </div>
              <div>
                <p className="text-[#9a958b]">Lucro</p>
                <p className={cn("font-semibold", profit < 0 ? "text-[#f87171]" : "text-[#60a5fa]")}>
                  {fmt(profit)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MarketingCrmView ─────────────────────────────────────────────────────────

export function MarketingCrmView({
  hideFinancials = false,
}: { hideFinancials?: boolean } = {}) {
  const [clients, setClients] = useState<MarketingClientDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<MarketingPipelineStage | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    void getMarketingClientsAction()
      .then(setClients)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selectedId && detailRef.current) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    }
  }, [selectedId]);

  function handleCardClick(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleClientUpdate(patch: Partial<MarketingClientDetail> & { id: string }) {
    setClients((prev) => prev.map((c) => (c.id === patch.id ? { ...c, ...patch } : c)));
  }

  const filtered = activeStage
    ? clients.filter((c) => c.pipelineStage === activeStage)
    : clients;

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;
  const countByStage = (key: MarketingPipelineStage) =>
    clients.filter((c) => c.pipelineStage === key).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#7b6fc0]/20">
            <Users className="size-4 text-[#c8bef5]" />
          </div>
          <p className="text-sm font-semibold text-white">
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddClient((x) => !x)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#7b6fc0] px-3 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(123,111,192,0.35)] transition hover:bg-[#8a7fd4]"
        >
          <Plus className="size-3.5" />
          {showAddClient ? "Cancelar" : "Novo cliente"}
        </button>
      </div>

      {/* Add client form */}
      {showAddClient && (
        <div className="rounded-2xl border border-[#7b6fc0]/25 bg-[#1e1b35]/60 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="size-4 text-[#c8bef5]" />
            <p className="text-sm font-semibold text-[#c8bef5]">Novo cliente</p>
          </div>
          <MarketingContractForm
            hideFinancials={hideFinancials}
            onSaved={() => { setShowAddClient(false); load(); }}
          />
        </div>
      )}

      {/* Content alerts */}
      {!loading && <ContentAlerts clients={clients} />}

      {/* Pipeline stage filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveStage(null)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
            activeStage === null
              ? "border-[#7b6fc0]/50 bg-[#7b6fc0]/18 text-[#c8bef5]"
              : "border-[rgba(245,241,232,0.1)] text-[#9a958b] hover:border-[rgba(245,241,232,0.2)] hover:text-white",
          )}
        >
          Todos ({clients.length})
        </button>
        {PIPELINE_STAGES.map((s) => {
          const count = countByStage(s.key);
          if (count === 0) return null;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveStage(activeStage === s.key ? null : s.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                activeStage === s.key
                  ? cn(s.textCls, s.borderCls, s.bgCls)
                  : "border-[rgba(245,241,232,0.1)] text-[#9a958b] hover:border-[rgba(245,241,232,0.2)] hover:text-white",
              )}
            >
              {s.short} ({count})
            </button>
          );
        })}
      </div>

      {/* Post-it grid */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <LoaderCircle className="size-6 animate-spin text-[#9a958b]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,241,232,0.12)] bg-white/[0.02] px-4 py-10 text-center">
          <Megaphone className="mb-3 size-7 text-[#5a544c]" />
          <p className="text-sm text-[#9a958b]">
            {activeStage
              ? `Nenhum cliente em "${stageInfo(activeStage).label}".`
              : "Nenhum cliente cadastrado ainda."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((client) => (
            <PostItCard
              key={client.id}
              client={client}
              selected={selectedId === client.id}
              onClick={() => handleCardClick(client.id)}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedClient && (
        <div ref={detailRef}>
          <ClientDetailPanel
            client={selectedClient}
            hideFinancials={hideFinancials}
            onUpdate={handleClientUpdate}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
