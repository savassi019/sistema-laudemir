"use client";

import type { ComponentType } from "react";

import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  ClipboardList,
  History,
  Inbox,
  MapPin,
  Receipt,
  Route,
  Search,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import { BilliardForm } from "@/components/modules/billiard-form";
import { BilliardHistoryOverview } from "@/components/modules/billiard-history-overview";
import { BxForm } from "@/components/modules/bx-form";
import { CarretaKidsForm } from "@/components/modules/carreta-kids-form";
import { MachineContractForm } from "@/components/modules/machine-contract-form";
import { MarketEntryForm } from "@/components/modules/market-entry-form";
import { MarketingCrmView } from "@/components/modules/marketing-crm-view";
import { ModuleAccountsPayable } from "@/components/modules/module-accounts-payable";
import { ModuleFinanceSection } from "@/components/modules/module-finance-section";
import { ModuleHistoryOverview } from "@/components/modules/module-history-overview";
import { ModuleReportTab } from "@/components/modules/module-report-tab";
import { PersonalFinanceForm } from "@/components/modules/personal-finance-form";
import { PlatformOnlineForm } from "@/components/modules/platform-online-form";
import { PlushForm } from "@/components/modules/plush-form";
import { RentalForm } from "@/components/modules/rental-form";
import { RoutesSection } from "@/components/modules/routes-section";
import { SlotForm } from "@/components/modules/slot-form";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import type { ModuleFinancialEntryItem } from "@/server/services/finance-service";
import type { ModuleClientItem, ModuleRecordItem } from "@/server/services/module-record-service";
import type { ModuleScopeSummary } from "@/server/services/module-scope-service";
import type { ClientListItem, ClientVisitSummary } from "@/types/app";

type SectionKey = "operacao" | "visita" | "rotas" | "clientes" | "financeiro" | "contas-pagar" | "historico" | "relatorio";

type ModuleFormProps = {
  hideFinancials?: boolean;
  startAtRegistration?: boolean;
  initialClientName?: string;
  initialPhone?: string;
  initialClientId?: string;
};

const formMap: Record<string, ComponentType<ModuleFormProps>> = {
  "carreta-kids": CarretaKidsForm,
  locacao: RentalForm,
  "maquinas-de-pelucia": PlushForm,
  bx: BxForm,
  "bilhar-pebolim": BilliardForm,
  "h-caca-niquel": SlotForm,
  "credito-financeiro": MachineContractForm,
  "mercado-autonomo": MarketEntryForm,
  marketing: MarketingCrmView,
  "plataforma-online": PlatformOnlineForm,
  "financas-pessoais": PersonalFinanceForm,
};

type SectionCfg = {
  label: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  accentBg: string;
  accentText: string;
};

const SECTION_CFG: Record<SectionKey, SectionCfg> = {
  operacao:      { label: "Operação",   description: "Registrar fechamento",    icon: ClipboardList, accent: "#d1a04f", accentBg: "bg-[#d1a04f]/15", accentText: "text-[#f3dfae]" },
  visita:        { label: "Visita",     description: "Fechar ponto e registrar visita", icon: MapPin, accent: "#a78bfa", accentBg: "bg-[#a78bfa]/15", accentText: "text-[#c4b5fd]" },
  rotas:         { label: "Rotas",      description: "Pontos agrupados por rota", icon: Route,  accent: "#a78bfa", accentBg: "bg-[#a78bfa]/15", accentText: "text-[#c4b5fd]" },
  clientes:      { label: "Clientes",   description: "Pontos cadastrados",      icon: UserPlus,      accent: "#60a5fa", accentBg: "bg-[#60a5fa]/15", accentText: "text-[#93c5fd]" },
  financeiro:    { label: "Financeiro", description: "Entradas e saídas",       icon: WalletCards,   accent: "#4ade80", accentBg: "bg-[#4ade80]/15", accentText: "text-[#86efac]" },
  "contas-pagar":{ label: "Contas",     description: "A pagar e receber",       icon: Receipt,       accent: "#fb923c", accentBg: "bg-[#fb923c]/15", accentText: "text-[#fdba74]" },
  historico:     { label: "Histórico",  description: "Registros anteriores",    icon: History,       accent: "#c8bef5", accentBg: "bg-[#c8bef5]/12", accentText: "text-[#ddd6fe]" },
  relatorio:     { label: "Relatório",  description: "Resumo financeiro",       icon: BarChart2,     accent: "#2dd4bf", accentBg: "bg-[#2dd4bf]/15", accentText: "text-[#5eead4]" },
};

const ALL_SECTIONS: SectionKey[] = ["operacao", "visita", "rotas", "clientes", "financeiro", "contas-pagar", "historico", "relatorio"];

const slugsWithoutClientConcept = new Set(["mercado-autonomo", "plataforma-online", "financas-pessoais"]);
// Rotas de campo hoje so existem no Bilhar (RoutePlan/BilliardPoint).
const slugsWithRoutes = new Set(["bilhar-pebolim"]);
const slugsWithVisitTracking = new Set([
  "bilhar-pebolim", "maquinas-de-pelucia", "bx", "h-caca-niquel", "carreta-kids", "locacao",
]);

export function ModuleWorkspace({
  slug,
  moduleTitle,
  summary,
  recentRecords: _recentRecords,
  clients = [],
  overdueClients = [],
  moduleClients = [],
  financialEntries = [],
  hideFinancials = false,
}: {
  slug: string;
  moduleTitle: string;
  summary: ModuleScopeSummary;
  recentRecords: ModuleRecordItem[];
  clients?: ClientListItem[];
  overdueClients?: ClientVisitSummary[];
  moduleClients?: ModuleClientItem[];
  financialEntries?: ModuleFinancialEntryItem[];
  hideFinancials?: boolean;
}) {
  const hasClientConcept = !slugsWithoutClientConcept.has(slug);
  const hasVisitTracking = slugsWithVisitTracking.has(slug);
  const hasRoutes = slugsWithRoutes.has(slug);
  const needsClientPreselect = hasVisitTracking;
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [visitPreset, setVisitPreset] = useState<{ id?: string; name: string; phone: string } | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  const Form = formMap[slug];

  const visibleSections = ALL_SECTIONS.filter((k) => {
    if (k === "operacao"      && hasVisitTracking)    return false; // Visita absorve o fechamento
    if (k === "visita"        && !hasVisitTracking)   return false;
    if (k === "rotas"         && !hasRoutes)          return false;
    if (k === "clientes"      && !hasClientConcept)   return false;
    if (k === "financeiro"    && hideFinancials)       return false;
    if (k === "contas-pagar"  && hideFinancials)       return false;
    if (k === "relatorio"     && hideFinancials)       return false;
    return true;
  });

  const pendingCount = financialEntries.filter(
    (e) => e.status === "PENDING" || e.status === "PARTIAL",
  ).length;

  // ── SECTION DETAIL VIEW ────────────────────────────────────────────────────
  if (activeSection) {
    const cfg = SECTION_CFG[activeSection];
    const Icon = cfg.icon;

    return (
      <section className="space-y-3">
        {/* Cabeçalho da seção */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveSection(null)}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.03] text-[#9a958b] transition hover:text-white active:scale-95"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", cfg.accentBg)}>
            <Icon className={cn("size-4", cfg.accentText)} />
          </div>
          <h2 className="text-base font-bold text-white">{cfg.label}</h2>
        </div>

        {/* Conteúdo da seção */}
        {activeSection === "operacao" ? (
          <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
            {Form ? (
              <Form hideFinancials={hideFinancials} />
            ) : (
              <p className="text-sm text-[#9a958b]">Formulário pendente.</p>
            )}
          </div>
        ) : null}

        {activeSection === "rotas" ? (
          <RoutesSection hideFinancials={hideFinancials} />
        ) : null}

        {activeSection === "visita" ? (
          <div className="space-y-3">
            {/* Etapa 1 – Selecionar ponto (lista unificada com badges de atraso) */}
            {needsClientPreselect && visitPreset === null ? (() => {
              const overdueMap = new Map(overdueClients.map((c) => [c.clientId, c.daysSinceVisit]));
              const filtered = clients.filter((c) =>
                c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                c.city?.toLowerCase().includes(clientSearch.toLowerCase()),
              );
              const overdueCount = clients.filter((c) => overdueMap.has(c.id)).length;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a958b]">
                      Selecionar ponto
                    </p>
                    {overdueCount > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-[#f87171]/12 px-2 py-0.5 text-[10px] font-semibold text-[#f87171]">
                        <span className="size-1.5 animate-pulse rounded-full bg-[#f87171]" />
                        {overdueCount} sem fechamento
                      </span>
                    )}
                  </div>
                  <input
                    type="search"
                    placeholder="Buscar pelo nome..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-[#9a958b] focus:border-[#a78bfa]/40 focus:outline-none"
                  />
                  <div className="space-y-1.5">
                    {filtered.map((c) => {
                      const days = overdueMap.get(c.id);
                      const isOverdue = days !== undefined;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setVisitPreset({ id: c.id, name: c.name, phone: c.phone }); setClientSearch(""); }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99]",
                            isOverdue
                              ? "border-[#f87171]/18 bg-[#1a0f0f]/60 hover:bg-[#1a0f0f]/90"
                              : "border-[rgba(245,241,232,0.08)] bg-white/[0.025] hover:bg-white/[0.05]",
                          )}
                        >
                          <MapPin className={cn("size-4 shrink-0", isOverdue ? "text-[#f87171]" : "text-[#a78bfa]")} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                            {c.city ? <p className="text-xs text-[#9a958b]">{c.city}</p> : null}
                          </div>
                          {isOverdue ? (
                            <span className="shrink-0 rounded-lg bg-[#f87171]/15 px-2 py-0.5 text-xs font-semibold text-[#f87171]">
                              {days! >= 999 ? "nunca" : `${days}d`}
                            </span>
                          ) : (
                            <ChevronRight className="size-4 shrink-0 text-[#5a544c]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setVisitPreset({ name: "", phone: "" })}
                    className="w-full pt-1 text-center text-xs text-[#9a958b] underline underline-offset-2 transition hover:text-white"
                  >
                    + Novo ponto não cadastrado
                  </button>
                </div>
              );
            })() : (
              /* Etapa 2 – Formulário */
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="flex size-5 items-center justify-center rounded-full bg-[#a78bfa]/20 text-[10px] font-bold text-[#c4b5fd]">2</span>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a958b]">Fechamento</p>
                  {needsClientPreselect ? (
                    <button
                      type="button"
                      onClick={() => setVisitPreset(null)}
                      className="ml-auto text-[11px] text-[#9a958b] underline underline-offset-2 transition hover:text-white"
                    >
                      ← Voltar
                    </button>
                  ) : null}
                </div>
                {visitPreset?.name ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[#a78bfa]/25 bg-[#a78bfa]/8 px-4 py-2.5">
                    <MapPin className="size-3.5 shrink-0 text-[#c4b5fd]" />
                    <p className="flex-1 text-sm font-semibold text-[#c4b5fd]">{visitPreset.name}</p>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
                  {Form ? (
                    <Form
                      key={visitPreset?.id ?? visitPreset?.name ?? "no-preset"}
                      hideFinancials={hideFinancials}
                      initialClientName={visitPreset?.name}
                      initialPhone={visitPreset?.phone}
                      initialClientId={visitPreset?.id}
                    />
                  ) : (
                    <p className="text-sm text-[#9a958b]">Formulário pendente.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {activeSection === "clientes" ? (
          <ClientesSection
            moduleClients={moduleClients}
            showRegisterForm={showRegisterForm}
            setShowRegisterForm={setShowRegisterForm}
            Form={Form}
            hideFinancials={hideFinancials}
          />
        ) : null}

        {activeSection === "financeiro" ? (
          <ModuleFinanceSection slug={slug} initialEntries={financialEntries} />
        ) : null}

        {activeSection === "contas-pagar" ? (
          <ModuleAccountsPayable slug={slug} initialEntries={financialEntries} />
        ) : null}

        {activeSection === "historico" ? (
          slug === "bilhar-pebolim" ? (
            <BilliardHistoryOverview hideFinancials={hideFinancials} />
          ) : (
            <ModuleHistoryOverview slug={slug} clients={moduleClients} hideFinancials={hideFinancials} />
          )
        ) : null}

        {activeSection === "relatorio" ? (
          <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
            <ModuleReportTab slug={slug} moduleTitle={moduleTitle} />
          </div>
        ) : null}
      </section>
    );
  }

  // ── HOME DO MÓDULO ─────────────────────────────────────────────────────────
  return (
    <section className="space-y-3">

      {/* Stats compactos */}
      {!hideFinancials ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Entradas",  value: formatCurrency(Number(summary.incomeAmount)),  accent: "#4ade80", dim: "text-[#86efac]" },
            { label: "Despesas",  value: formatCurrency(Number(summary.expenseAmount)), accent: "#f87171", dim: "text-[#fca5a5]" },
            { label: "Resultado", value: formatCurrency(Number(summary.balanceAmount)), accent: "#60a5fa", dim: "text-[#93c5fd]" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0c100f]/80 px-3 py-3"
              style={{ borderTopColor: s.accent, borderTopWidth: 2 }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#9a958b]">{s.label}</p>
              <p className={cn("mt-1 text-sm font-bold leading-tight", s.dim)}>{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Alerta de pendências */}
      {hasVisitTracking && overdueClients.length > 0 ? (
        <button
          type="button"
          onClick={() => setActiveSection("visita")}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#f87171]/25 bg-[#1a0f0f]/70 px-4 py-3 text-left transition hover:bg-[#1a0f0f]/90 active:scale-[0.99]"
        >
          <span className="flex size-2 shrink-0">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-[#f87171] opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-[#f87171]" />
          </span>
          <p className="flex-1 text-sm font-semibold text-[#f87171]">
            {overdueClients.length} {overdueClients.length === 1 ? "ponto" : "pontos"} sem fechamento há +15 dias
          </p>
          <ChevronRight className="size-4 shrink-0 text-[#f87171]/60" />
        </button>
      ) : null}

      {/* Lista de seções */}
      <div className="overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35">
        {visibleSections.map((key, idx) => {
          const cfg = SECTION_CFG[key];
          const Icon = cfg.icon;
          const isLast = idx === visibleSections.length - 1;
          const badge =
            key === "clientes" ? String(summary.clientsCount) :
            key === "contas-pagar" && pendingCount > 0 ? String(pendingCount) :
            null;
          const hasAlert = key === "visita" && overdueClients.length > 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={cn(
                "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] active:scale-[0.99]",
                !isLast && "border-b border-[rgba(245,241,232,0.06)]",
              )}
            >
              <div
                className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", cfg.accentBg)}
              >
                <Icon className={cn("size-4", cfg.accentText)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{cfg.label}</p>
                <p className="mt-0.5 text-xs text-[#9a958b]">{cfg.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hasAlert ? (
                  <span className="flex size-2">
                    <span className="absolute inline-flex size-2 animate-ping rounded-full bg-[#f87171] opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-[#f87171]" />
                  </span>
                ) : null}
                {badge ? (
                  <span
                    className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{ borderColor: `${cfg.accent}40`, color: cfg.accentText.replace("text-[", "").replace("]", "") }}
                  >
                    {badge}
                  </span>
                ) : null}
                <ChevronRight className="size-4 text-[#5a544c]" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Aba Clientes com busca ────────────────────────────────────────────────────

function ClientesSection({
  moduleClients,
  showRegisterForm,
  setShowRegisterForm,
  Form,
  hideFinancials,
}: {
  moduleClients: ModuleClientItem[];
  showRegisterForm: boolean;
  setShowRegisterForm: (fn: (x: boolean) => boolean) => void;
  Form: ComponentType<{ hideFinancials?: boolean; startAtRegistration?: boolean }> | null;
  hideFinancials: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? moduleClients.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.subtitle?.toLowerCase().includes(query.toLowerCase()),
      )
    : moduleClients;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Clientes cadastrados</h3>
            <p className="mt-0.5 text-xs text-[#9a958b]">Cadastre aqui mesmo, sem trocar de tela.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowRegisterForm((x) => !x)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#d1a04f] px-3 py-2 text-xs font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855]"
          >
            <UserPlus className="size-3.5" />
            {showRegisterForm ? "Ocultar" : "Novo"}
          </button>
        </div>
        {showRegisterForm && Form ? (
          <div className="mt-4 border-t border-[rgba(245,241,232,0.08)] pt-4">
            <Form hideFinancials={hideFinancials} startAtRegistration />
          </div>
        ) : null}
      </div>

      {moduleClients.length > 4 ? (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-[#5a544c]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou código..."
            className="w-full rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-white outline-none placeholder:text-[#5a544c] focus:border-[#d1a04f]/40 focus:ring-1 focus:ring-[#d1a04f]/20"
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,241,232,0.14)] bg-white/[0.02] px-4 py-10 text-center">
          <Inbox className="mb-3 size-7 text-[#5a544c]" />
          <p className="text-sm text-[#9a958b]">
            {query ? "Nenhum cliente encontrado para essa busca." : "Nenhum cliente cadastrado ainda."}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-white/[0.025] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                  {item.subtitle ? <p className="mt-0.5 truncate text-xs text-[#9a958b]">{item.subtitle}</p> : null}
                </div>
                {item.badge ? (
                  <span className="shrink-0 rounded-full border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-2 py-1 text-[11px] font-medium text-[#f3dfae]">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              {item.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#9a958b]">
                  {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
