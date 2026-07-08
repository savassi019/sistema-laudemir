"use client";

import type { ComponentType } from "react";

import { ClipboardCheck, ClipboardList, History, Inbox, UserPlus, WalletCards } from "lucide-react";
import { useState } from "react";

import { BilliardForm } from "@/components/modules/billiard-form";
import { BilliardHistoryOverview } from "@/components/modules/billiard-history-overview";
import { ModuleHistoryOverview } from "@/components/modules/module-history-overview";
import { BxForm } from "@/components/modules/bx-form";
import { CarretaKidsForm } from "@/components/modules/carreta-kids-form";
import { MachineContractForm } from "@/components/modules/machine-contract-form";
import { MarketEntryForm } from "@/components/modules/market-entry-form";
import { MarketingContractForm } from "@/components/modules/marketing-contract-form";
import { ModuleFinanceSection } from "@/components/modules/module-finance-section";
import { PersonalFinanceForm } from "@/components/modules/personal-finance-form";
import { PlatformOnlineForm } from "@/components/modules/platform-online-form";
import { PlushForm } from "@/components/modules/plush-form";
import { RentalForm } from "@/components/modules/rental-form";
import { SlotForm } from "@/components/modules/slot-form";
import { QuickVisitForm } from "@/components/visita/quick-visit-form";
import { cn } from "@/lib/cn";
import { formatCurrency, formatShortDate } from "@/lib/format";
import type { ModuleClientItem, ModuleRecordItem } from "@/server/services/module-record-service";
import type { ModuleFinancialEntryItem } from "@/server/services/finance-service";
import type { ModuleScopeSummary } from "@/server/services/module-scope-service";
import type { ClientListItem, ClientVisitSummary } from "@/types/app";

type TabKey = "operacao" | "visita" | "clientes" | "financeiro" | "historico";

type ModuleFormProps = { hideFinancials?: boolean; startAtRegistration?: boolean };

const formMap: Record<string, ComponentType<ModuleFormProps>> = {
  "carreta-kids": CarretaKidsForm,
  locacao: RentalForm,
  "maquinas-de-pelucia": PlushForm,
  bx: BxForm,
  "bilhar-pebolim": BilliardForm,
  "h-caca-niquel": SlotForm,
  "credito-financeiro": MachineContractForm,
  "mercado-autonomo": MarketEntryForm,
  marketing: MarketingContractForm,
  "plataforma-online": PlatformOnlineForm,
  "financas-pessoais": PersonalFinanceForm,
};

const tabs = [
  { key: "operacao", label: "Operação", icon: ClipboardList },
  { key: "visita", label: "Visita", icon: ClipboardCheck },
  { key: "clientes", label: "Clientes", icon: UserPlus },
  { key: "financeiro", label: "Financeiro", icon: WalletCards },
  { key: "historico", label: "Histórico", icon: History },
] as const;

const slugsWithoutClientConcept = new Set(["mercado-autonomo", "plataforma-online", "financas-pessoais"]);

const slugToVisitType: Record<string, string> = {
  "bilhar-pebolim": "BILLIARD",
  "maquinas-de-pelucia": "PLUSH",
  bx: "BX",
  "h-caca-niquel": "SLOT_H",
  "carreta-kids": "CARRETA_KIDS",
  locacao: "RENTAL",
};

const rules = [
  "Fotos e comprovantes quando o fluxo pedir.",
  "Entrada e saída sem apagar histórico.",
  "Exceção só com regra do cliente.",
  "Salvar sempre com status correto.",
];

function getStatValue(summary: ModuleScopeSummary, key: keyof ModuleScopeSummary) {
  if (key === "clientsCount") {
    return String(summary.clientsCount);
  }

  return formatCurrency(Number(summary[key]));
}

export function ModuleWorkspace({
  slug,
  moduleTitle,
  summary,
  recentRecords,
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
  const visitType = slugToVisitType[slug];
  const hasClientConcept = !slugsWithoutClientConcept.has(slug);
  const [activeTab, setActiveTab] = useState<TabKey>("operacao");
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [preselectedClientId, setPreselectedClientId] = useState<string | undefined>();
  const visibleTabs = tabs
    .filter((t) => t.key !== "visita" || !!visitType)
    .filter((t) => t.key !== "clientes" || hasClientConcept)
    .filter((t) => t.key !== "financeiro" || !hideFinancials);
  const Form = formMap[slug];

  return (
    <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.2)] md:p-4">
      <div className={cn("grid gap-1.5", hideFinancials ? "grid-cols-1" : "grid-cols-4")}>
        {[
          { label: "Clientes", value: getStatValue(summary, "clientsCount"), accent: "#d1a04f" },
          ...(hideFinancials
            ? []
            : [
                { label: "Entradas", value: getStatValue(summary, "incomeAmount"), accent: "#4ade80" },
                { label: "Despesas", value: getStatValue(summary, "expenseAmount"), accent: "#f87171" },
                { label: "Resultado", value: getStatValue(summary, "balanceAmount"), accent: "#60a5fa" },
              ]),
        ].map((item) => (
          <article
            key={item.label}
            className="overflow-hidden rounded-lg border-l-2 bg-[#0b0f0e]/55 px-1.5 py-1.5"
            style={{ borderLeftColor: item.accent }}
          >
            <p className="truncate text-[9px] text-[#8d867a]">{item.label}</p>
            <p className="truncate text-[12px] font-semibold text-white md:text-sm">{item.value}</p>
          </article>
        ))}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                active
                  ? "border-[#d1a04f]/50 bg-[#d1a04f]/18 text-[#f3dfae] shadow-[0_0_12px_rgba(209,160,79,0.2),inset_0_1px_0_rgba(209,160,79,0.12)]"
                  : "border-[rgba(245,241,232,0.1)] bg-white/[0.025] text-[#c9c2b4] hover:border-[rgba(245,241,232,0.18)] hover:text-[#dcd6ca]",
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {activeTab === "visita" && visitType ? (
          <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-3 md:p-4">
            {overdueClients.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-[#f87171]/20 bg-[#1a0f0f]/60 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-2 animate-pulse rounded-full bg-[#f87171]" />
                  <p className="text-sm font-semibold text-[#f87171]">
                    {overdueClients.length} {overdueClients.length === 1 ? "ponto sem visita" : "pontos sem visita"} há +15 dias
                  </p>
                </div>
                <div className="space-y-1.5">
                  {overdueClients.slice(0, 5).map((c) => (
                    <button
                      key={c.clientId}
                      type="button"
                      onClick={() => {
                        setPreselectedClientId(c.clientId);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#f87171]/12 bg-[#0b0f0e]/55 px-3 py-2.5 transition hover:border-[#f87171]/30 hover:bg-[#1a0f0f]/80"
                    >
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-semibold text-white">{c.clientName}</p>
                        <p className="text-xs text-[#9a958b]">{c.city || c.clientCode}</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-[#f87171]/12 px-2 py-0.5 text-xs font-medium text-[#f87171]">
                        {c.daysSinceVisit >= 999 ? "nunca" : `${c.daysSinceVisit}d`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-white">Visita</h2>
              <p className="text-sm text-[#9a958b]">Registre a visita e gere o comprovante.</p>
            </div>
            <QuickVisitForm
              clients={clients}
              initialClientId={preselectedClientId}
              initialVisitType={visitType}
              useModuleTarget
            />
          </div>
        ) : null}

        {activeTab === "operacao" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-3 md:p-4">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-white">Operação</h2>
                <p className="text-sm text-[#9a958b]">Registro principal de {moduleTitle}.</p>
              </div>
              {Form ? (
                <Form hideFinancials={hideFinancials} />
              ) : (
                <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-white/[0.025] p-4 text-sm text-[#c9c2b4]">
                  Formulário ainda pendente para este módulo.
                </div>
              )}
            </div>

            <aside className="hidden rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-3 xl:block">
              <h3 className="text-sm font-semibold text-white">Regras rápidas</h3>
              <div className="mt-3 space-y-2">
                {rules.map((rule, i) => (
                  <div
                    key={rule}
                    className="flex items-start gap-2.5 rounded-xl border border-[rgba(245,241,232,0.08)] bg-white/[0.025] px-3 py-2.5"
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-[#d1a04f]/30 bg-[#d1a04f]/10 text-[10px] font-bold text-[#d1a04f]">
                      {i + 1}
                    </span>
                    <p className="text-xs leading-5 text-[#c9c2b4]">{rule}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        ) : null}

        {activeTab === "clientes" ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Clientes cadastrados</h2>
                  <p className="mt-0.5 text-xs text-[#9a958b]">
                    Cadastro completo aqui mesmo, sem precisar trocar de aba.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRegisterForm((current) => !current)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#d1a04f] px-3 py-2 text-xs font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)] transition hover:bg-[#daa855]"
                >
                  <UserPlus className="size-3.5" />
                  {showRegisterForm ? "Ocultar" : "Novo cliente"}
                </button>
              </div>

              {showRegisterForm && Form ? (
                <div className="mt-4 border-t border-[rgba(245,241,232,0.08)] pt-4">
                  <Form hideFinancials={hideFinancials} startAtRegistration />
                </div>
              ) : null}
            </div>

            {moduleClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,241,232,0.14)] bg-white/[0.02] px-4 py-8 text-center">
                <Inbox className="mb-3 size-7 text-[#5a544c]" />
                <p className="text-sm text-[#9a958b]">Nenhum cliente cadastrado ainda.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {moduleClients.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-white/[0.025] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                        {item.subtitle ? (
                          <p className="mt-0.5 truncate text-xs text-[#9a958b]">{item.subtitle}</p>
                        ) : null}
                      </div>
                      {item.badge ? (
                        <span className="shrink-0 rounded-full border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-2 py-1 text-[11px] font-medium text-[#f3dfae]">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    {item.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#9a958b]">
                        {item.tags.map((tag) => (
                          <span key={tag} className="flex items-center gap-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "financeiro" ? (
          <ModuleFinanceSection slug={slug} initialEntries={financialEntries} />
        ) : null}

        {activeTab === "historico" ? (
          slug === "bilhar-pebolim" ? (
            <BilliardHistoryOverview hideFinancials={hideFinancials} />
          ) : (
            <ModuleHistoryOverview slug={slug} clients={moduleClients} hideFinancials={hideFinancials} />
          )
        ) : null}
      </div>
    </section>
  );
}

