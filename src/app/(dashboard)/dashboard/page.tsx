import {
  AlertTriangle,
  BellDot,
  ChartColumn,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  MapPin,
  UserPlus,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { MetricCard } from "@/components/dashboard/metric-card";
import { ModuleTile } from "@/components/dashboard/module-tile";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { RemindersSection } from "@/components/dashboard/reminders-section";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SectionCard } from "@/components/ui/section-card";
import { requireSession } from "@/lib/auth";
import { getVisibleModuleGroups } from "@/lib/module-catalog";
import { getDashboardOverview } from "@/server/services/dashboard-service";
import { listClients } from "@/server/services/client-service";
import { getRouteOfDay, getTodayVisitCount, getUnvisitedClients } from "@/server/services/visit-service";

export const dynamic = "force-dynamic";

const mobileOrder = ["field", "special", "transversal", "core", "business"] as const;

export default async function DashboardPage() {
  const session = await requireSession("DASHBOARD");
  const [overview, clients] = await Promise.all([
    getDashboardOverview(session),
    listClients(session),
  ]);
  const isFieldView = session.role === "STAFF";

  const [routeOfDay, unvisitedClients, todayVisitCount] = await Promise.all([
    isFieldView ? getRouteOfDay(session, clients) : Promise.resolve([]),
    !isFieldView ? getUnvisitedClients(session, clients, 15) : Promise.resolve([]),
    getTodayVisitCount(session),
  ]);
  const openReminders = overview.reminders.filter(
    (reminder) => reminder.status === "aberto",
  );

  const visibleGroups = getVisibleModuleGroups(session.modules).sort((left, right) => {
    const leftIndex = mobileOrder.indexOf(left.key);
    const rightIndex = mobileOrder.indexOf(right.key);
    return leftIndex - rightIndex;
  });

  const fieldActions = [
    {
      href: "/visita-rapida",
      title: "Visita",
      description: "Checklist, foto e comprovante.",
      icon: ClipboardCheck,
      tone: "amber" as const,
    },
    {
      href: "/clientes",
      title: "Cliente",
      description: "Cadastrar ou consultar.",
      icon: UserPlus,
      tone: "sky" as const,
    },
    {
      href: "/financeiro",
      title: "Valor",
      description: "Registrar recebido ou parcial.",
      icon: WalletCards,
      tone: "emerald" as const,
    },
    {
      href: "/modulos",
      title: "Módulo",
      description: "Abrir rotina de campo.",
      icon: ClipboardList,
      tone: "rose" as const,
    },
  ];

  const ownerActions = [
    {
      href: "/financeiro",
      title: "Financeiro",
      description: "Entradas, saídas e pendências.",
      icon: ChartColumn,
      tone: "sky" as const,
    },
    {
      href: "/clientes",
      title: "Clientes",
      description: "Saldo e histórico.",
      icon: UserPlus,
      tone: "emerald" as const,
    },
    {
      href: "/modulos",
      title: "Módulos",
      description: "Operações ativas.",
      icon: ClipboardList,
      tone: "amber" as const,
    },
    {
      href: "/dashboard#agenda",
      title: "Pendências",
      description: "Tarefas abertas.",
      icon: BellDot,
      tone: "rose" as const,
    },
  ];

  const actions = isFieldView ? fieldActions : ownerActions;

  return (
    <div className="space-y-3 md:space-y-4">
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] md:p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#9a958b]">
              {isFieldView ? "Hoje" : "Visão geral"}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white md:text-3xl">
              {isFieldView ? "O que fazer agora" : "Controle do dia"}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="rounded-xl border border-[#8aa17c]/30 bg-[#8aa17c]/10 px-3 py-1 text-xs font-semibold text-[#8aa17c]">
              {todayVisitCount} {todayVisitCount === 1 ? "visita hoje" : "visitas hoje"}
            </div>
            <div className={`rounded-xl border px-3 py-1 text-xs font-medium ${openReminders.length > 0 ? "border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171]" : "border-[#d1a04f]/28 bg-[#d1a04f]/12 text-[#f3dfae]"}`}>
              {openReminders.length} pendências
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
          {actions.map((action) => (
            <QuickActionCard
              key={action.title}
              href={action.href}
              title={action.title}
              description={action.description}
              icon={action.icon}
              tone={action.tone}
            />
          ))}
        </div>
      </section>

      {isFieldView && routeOfDay.length > 0 ? (
        <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-3.5 md:p-4">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="size-4 text-[#d1a04f]" />
            <h2 className="text-base font-semibold text-white">Rota do dia</h2>
            <span className="ml-auto text-xs text-[#9a958b]">por prioridade de visita</span>
          </div>
          <div className="space-y-2">
            {routeOfDay.map((c) => (
              <Link
                key={c.clientId}
                href={`/visita-rapida?clientId=${c.clientId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/55 px-3 py-3 transition hover:border-[#d1a04f]/25 hover:bg-[#d1a04f]/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{c.clientName}</p>
                  <p className="text-xs text-[#9a958b]">{c.city}</p>
                </div>
                <div className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  c.daysSinceVisit >= 15
                    ? "bg-[#f87171]/10 text-[#f87171]"
                    : c.daysSinceVisit >= 7
                      ? "bg-[#d1a04f]/12 text-[#f3dfae]"
                      : "bg-white/[0.05] text-[#9a958b]"
                }`}>
                  {c.daysSinceVisit >= 999 ? "Nunca visitado" : `${c.daysSinceVisit}d`}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!isFieldView && unvisitedClients.length > 0 ? (
        <section className="rounded-2xl border border-[#f87171]/20 bg-[#1a0f0f]/60 p-3.5 md:p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#f87171]" />
            <h2 className="text-base font-semibold text-white">Clientes sem visita</h2>
            <span className="ml-auto text-xs text-[#9a958b]">{unvisitedClients.length} acima de 15 dias</span>
          </div>
          <div className="space-y-2">
            {unvisitedClients.slice(0, 5).map((c) => (
              <Link
                key={c.clientId}
                href={`/clientes/${c.clientId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#f87171]/10 bg-[#0b0f0e]/55 px-3 py-3 transition hover:border-[#f87171]/25"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{c.clientName}</p>
                  <p className="text-xs text-[#9a958b]">{c.clientCode} · {c.city}</p>
                </div>
                <div className="shrink-0 rounded-lg bg-[#f87171]/10 px-2.5 py-1 text-xs font-medium text-[#f87171]">
                  {c.daysSinceVisit >= 999 ? "Nunca" : `${c.daysSinceVisit}d`}
                </div>
              </Link>
            ))}
          </div>
          {unvisitedClients.length > 5 ? (
            <Link
              href="/clientes"
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#f87171]/15 bg-[#f87171]/5 py-2.5 text-xs font-medium text-[#f87171] transition hover:bg-[#f87171]/10"
            >
              Ver todos os {unvisitedClients.length} clientes sem visita
              <ChevronRight className="size-3.5" />
            </Link>
          ) : null}
        </section>
      ) : null}

      <section id="agenda" className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-3.5 md:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">Pendências</h2>
          <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${openReminders.length > 0 ? "bg-[#f87171]/10 text-[#f87171]" : "bg-[#8aa17c]/10 text-[#8aa17c]"}`}>
            {openReminders.length} em aberto
          </span>
        </div>
        <RemindersSection reminders={overview.reminders} maxItems={isFieldView ? 3 : 4} />
      </section>

      {!isFieldView ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {overview.metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <SectionCard
            title="Fluxo financeiro"
            subtitle="Receitas e despesas recentes."
          >
            <RevenueChart data={overview.cashflow} />
          </SectionCard>
        </>
      ) : null}

      {!isFieldView ? (
        <section id="modulos" className="space-y-4">
          {visibleGroups.slice(0, 5).map((group) => (
            <SectionCard key={group.key} title={group.title}>
              <div className="grid gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-3">
                {group.items.slice(0, 9).map((item) => (
                  <ModuleTile key={item.module} item={item} />
                ))}
              </div>
            </SectionCard>
          ))}
        </section>
      ) : null}
    </div>
  );
}
