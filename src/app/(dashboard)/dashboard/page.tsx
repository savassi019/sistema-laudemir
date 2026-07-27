import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Eye,
  MapPin,
  Megaphone,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

import { MetricCard } from "@/components/dashboard/metric-card";
import { NotificationPermissionBanner, PushNotifier } from "@/components/dashboard/push-notifier";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardOverview } from "@/server/services/dashboard-service";
import { getTodayVisitCount, getUnvisitedClients } from "@/server/services/visit-service";
import { listClients } from "@/server/services/client-service";

export const dynamic = "force-dynamic";

const PT_WEEK = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const PT_MONTH = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function fmtDate(d: Date) {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

export default async function DashboardPage() {
  const session = await requireSession("DASHBOARD");
  const isField = session.role === "STAFF";
  const orgId   = session.organizationId;

  const now = new Date();
  const dateStr = `${PT_WEEK[now.getDay()]}, ${now.getDate()} de ${PT_MONTH[now.getMonth()]}`;

  const [overview, clients, todayVisitCount] = await Promise.all([
    getDashboardOverview(session),
    listClients(session),
    getTodayVisitCount(session),
  ]);

  const [unvisitedClients, overdueContent, soonContent] = await Promise.all([
    !isField ? getUnvisitedClients(session, clients, 15) : Promise.resolve([]),
    !isField ? prisma.marketingContent.findMany({
      where: { organizationId: orgId, status: "PENDING", contentDate: { lt: now } },
      include: { contract: { select: { name: true } } },
      orderBy: { contentDate: "asc" },
      take: 8,
    }).catch(() => []) : Promise.resolve([]),
    !isField ? prisma.marketingContent.findMany({
      where: {
        organizationId: orgId,
        status: "PENDING",
        contentDate: { gte: now, lte: new Date(now.getTime() + 3 * 86_400_000) },
      },
      include: { contract: { select: { name: true } } },
      orderBy: { contentDate: "asc" },
      take: 8,
    }).catch(() => []) : Promise.resolve([]),
  ]);

  const openReminders   = overview.reminders.filter((r) => r.status === "aberto");
  const totalAlerts     = unvisitedClients.length + overdueContent.length + openReminders.length;
  const allClear        = totalAlerts === 0 && soonContent.length === 0;

  return (
    <div className="space-y-3 md:space-y-4">

      <PushNotifier
        alertCount={totalAlerts}
        unvisitedCount={unvisitedClients.length}
        overdueContentCount={overdueContent.length}
        openRemindersCount={openReminders.length}
      />

      <NotificationPermissionBanner />

      {/* ━━━━━━ HERO ━━━━━━ */}
      <section
        className={`relative overflow-hidden rounded-2xl p-5 md:p-6 ${
          allClear
            ? "bg-[radial-gradient(ellipse_at_top_left,rgba(74,222,128,0.14),transparent_60%),#0e1a12] border border-[#4ade80]/20"
            : "bg-[radial-gradient(ellipse_at_top_left,rgba(248,113,113,0.16),transparent_55%),#180e0e] border border-[#f87171]/20"
        }`}
      >
        {/* background glow */}
        <div className={`pointer-events-none absolute -right-12 -top-12 size-48 rounded-full blur-3xl ${allClear ? "bg-[#4ade80]/8" : "bg-[#f87171]/8"}`} />

        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#9a958b]">{dateStr}</p>

        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {allClear ? "Tudo em dia" : `${totalAlerts} alerta${totalAlerts !== 1 ? "s" : ""}`}
            </h1>
            <p className={`mt-1 text-sm font-medium ${allClear ? "text-[#4ade80]" : "text-[#f87171]"}`}>
              {allClear
                ? "Sem pendências · sistema operando normalmente"
                : "Itens abaixo precisam de atenção"}
            </p>
          </div>
          {allClear
            ? <CheckCircle2 className="size-10 shrink-0 text-[#4ade80]/60" />
            : <AlertTriangle className="size-10 shrink-0 text-[#f87171]/60" />
          }
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { value: String(todayVisitCount), label: "visitas hoje", Icon: MapPin, color: "text-[#8aa17c]" },
            { value: String(totalAlerts),     label: "alertas",      Icon: AlertTriangle, color: totalAlerts > 0 ? "text-[#f87171]" : "text-[#4ade80]" },
            { value: String(clients.length),  label: "clientes",     Icon: Users, color: "text-[#60a5fa]" },
          ].map(({ value, label, Icon, color }) => (
            <div key={label} className="rounded-xl bg-white/[0.04] p-3 text-center">
              <Icon className={`mx-auto mb-1 size-4 ${color}`} />
              <p className="text-lg font-bold text-white leading-none">{value}</p>
              <p className="mt-0.5 text-[10px] text-[#9a958b]">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick nav */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { href: "/modulos",    label: "Módulos",    Icon: ClipboardList },
            { href: "/financeiro", label: "Financeiro", Icon: CircleDollarSign },
            { href: "/clientes",   label: "Clientes",   Icon: Users },
            { href: "/relatorio",  label: "Relatório",  Icon: TrendingUp },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(245,241,232,0.12)] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-[#c9c2b4] transition hover:bg-white/[0.1] hover:text-white"
            >
              <Icon className="size-3.5" />{label}
            </Link>
          ))}
        </div>
      </section>

      {/* ━━━━━━ ALERTA: conteúdos atrasados ━━━━━━ */}
      {overdueContent.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[#f87171]/25 bg-[#190d0d]">
          <div className="flex items-center gap-3 bg-[#f87171]/12 px-4 py-3.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#f87171]/20">
              <Megaphone className="size-4 text-[#f87171]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#f87171]">Conteúdos atrasados</p>
              <p className="text-xs text-[#9a958b]">Marketing · pendentes sem entrega</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#f87171] px-2.5 py-0.5 text-xs font-bold text-white">
              {overdueContent.length}
            </span>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {overdueContent.map((cnt) => (
              <Link
                key={cnt.id}
                href="/modulos/marketing"
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
              >
                <div className="size-1.5 shrink-0 rounded-full bg-[#f87171]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{cnt.title}</p>
                  <p className="text-xs text-[#9a958b]">{cnt.contract.name}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-[#f87171]/12 px-2 py-0.5 text-xs font-semibold text-[#f87171]">
                  {fmtDate(cnt.contentDate)}
                </span>
              </Link>
            ))}
          </div>
          <div className="border-t border-[rgba(255,255,255,0.04)] px-4 py-2.5">
            <Link href="/modulos/marketing" className="flex items-center gap-1 text-xs font-medium text-[#f87171]/70 transition hover:text-[#f87171]">
              Abrir módulo Marketing <ChevronRight className="size-3" />
            </Link>
          </div>
        </section>
      )}

      {/* ━━━━━━ ALERTA: conteúdos vencendo em breve ━━━━━━ */}
      {soonContent.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[#fb923c]/25 bg-[#18100a]">
          <div className="flex items-center gap-3 bg-[#fb923c]/12 px-4 py-3.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#fb923c]/20">
              <AlertTriangle className="size-4 text-[#fb923c]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#fb923c]">Vencem em breve</p>
              <p className="text-xs text-[#9a958b]">Conteúdos pendentes nos próximos 3 dias</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#fb923c] px-2.5 py-0.5 text-xs font-bold text-white">
              {soonContent.length}
            </span>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {soonContent.map((cnt) => (
              <Link
                key={cnt.id}
                href="/modulos/marketing"
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
              >
                <div className="size-1.5 shrink-0 rounded-full bg-[#fb923c]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{cnt.title}</p>
                  <p className="text-xs text-[#9a958b]">{cnt.contract.name}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-[#fb923c]/12 px-2 py-0.5 text-xs font-semibold text-[#fb923c]">
                  {fmtDate(cnt.contentDate)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ━━━━━━ ALERTA: clientes sem visita ━━━━━━ */}
      {unvisitedClients.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[#60a5fa]/20 bg-[#0a0f1a]">
          <div className="flex items-center gap-3 bg-[#60a5fa]/10 px-4 py-3.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#60a5fa]/18">
              <MapPin className="size-4 text-[#60a5fa]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#60a5fa]">Clientes sem visita</p>
              <p className="text-xs text-[#9a958b]">Sem registro de visita há mais de 15 dias</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#60a5fa] px-2.5 py-0.5 text-xs font-bold text-white">
              {unvisitedClients.length}
            </span>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {unvisitedClients.slice(0, 5).map((c) => (
              <Link
                key={c.clientId}
                href={`/clientes/${c.clientId}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
              >
                <div className="size-1.5 shrink-0 rounded-full bg-[#60a5fa]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{c.clientName}</p>
                  <p className="text-xs text-[#9a958b]">{c.clientCode} · {c.city}</p>
                </div>
                <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${c.daysSinceVisit >= 30 ? "bg-[#f87171]/12 text-[#f87171]" : "bg-[#60a5fa]/12 text-[#60a5fa]"}`}>
                  {c.daysSinceVisit >= 999 ? "Nunca" : `${c.daysSinceVisit}d`}
                </span>
              </Link>
            ))}
          </div>
          {unvisitedClients.length > 5 && (
            <div className="border-t border-[rgba(255,255,255,0.04)] px-4 py-2.5">
              <Link href="/clientes" className="flex items-center gap-1 text-xs font-medium text-[#60a5fa]/70 transition hover:text-[#60a5fa]">
                Ver todos os {unvisitedClients.length} <ChevronRight className="size-3" />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ━━━━━━ ALERTA: cobranças vencidas ━━━━━━ */}
      {openReminders.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[#d1a04f]/22 bg-[#150f05]">
          <div className="flex items-center gap-3 bg-[#d1a04f]/10 px-4 py-3.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#d1a04f]/18">
              <CircleDollarSign className="size-4 text-[#f3dfae]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#f3dfae]">Cobranças em aberto</p>
              <p className="text-xs text-[#9a958b]">Financeiro · vencidas ou próximas do vencimento</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#d1a04f] px-2.5 py-0.5 text-xs font-bold text-[#1a0d00]">
              {openReminders.length}
            </span>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {openReminders.slice(0, 4).map((r) => (
              <Link
                key={r.id}
                href="/financeiro"
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
              >
                <div className="size-1.5 shrink-0 rounded-full bg-[#d1a04f]" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{r.title}</p>
                <ChevronRight className="size-3.5 shrink-0 text-[#9a958b]" />
              </Link>
            ))}
          </div>
          <div className="border-t border-[rgba(255,255,255,0.04)] px-4 py-2.5">
            <Link href="/financeiro" className="flex items-center gap-1 text-xs font-medium text-[#f3dfae]/60 transition hover:text-[#f3dfae]">
              Abrir Financeiro <ChevronRight className="size-3" />
            </Link>
          </div>
        </section>
      )}

      {/* ━━━━━━ MÉTRICAS ━━━━━━ */}
      {!isField && (
        <section>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">Resumo financeiro</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {overview.metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </section>
      )}

      {/* ━━━━━━ ACESSO RÁPIDO AOS MÓDULOS ━━━━━━ */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">Acesso rápido</p>
          <Link href="/modulos" className="flex items-center gap-1 text-[11px] text-[#9a958b] transition hover:text-white">
            Ver todos <ChevronRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { href: "/modulos/bilhar-pebolim",       emoji: "🎱", label: "Bilhar / Pebolim"    },
            { href: "/modulos/maquinas-de-pelucia",  emoji: "🧸", label: "Pelúcia"             },
            { href: "/modulos/h-caca-niquel",         emoji: "🎰", label: "H / Caça-níquel"    },
            { href: "/modulos/bx",                    emoji: "📦", label: "BX"                 },
            { href: "/modulos/marketing",             emoji: "📣", label: "Marketing"          },
            { href: "/modulos/carreta-kids",          emoji: "🎠", label: "Carreta Kids"       },
          ].map(({ href, emoji, label }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-2xl border border-[rgba(245,241,232,0.08)] bg-white/[0.025] px-4 py-3.5 transition hover:border-[rgba(245,241,232,0.15)] hover:bg-white/[0.05]"
            >
              <span className="text-xl leading-none">{emoji}</span>
              <span className="truncate text-sm font-medium text-[#c9c2b4] group-hover:text-white">{label}</span>
              <Eye className="ml-auto size-3.5 shrink-0 text-[#5a544c] opacity-0 transition group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
