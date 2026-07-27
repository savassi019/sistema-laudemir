import {
  BarChart2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  Gift,
  Globe,
  LayoutGrid,
  Megaphone,
  Notebook,
  Receipt,
  Shield,
  ShoppingBag,
  Store,
  Table2,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getDashboardOverview, getPainelAlerts } from "@/server/services/dashboard-service";

export const dynamic = "force-dynamic";

const fieldModules = [
  { href: "/modulos/bilhar-pebolim",       label: "Bilhar / Pebolim",      icon: Table2,       emoji: "🎱" },
  { href: "/modulos/maquinas-de-pelucia",  label: "Máquinas de Pelúcia",   icon: Gift,         emoji: "🧸" },
  { href: "/modulos/h-caca-niquel",        label: "H (Caça-níquel)",        icon: Wallet,       emoji: "🎰" },
  { href: "/modulos/bx",                   label: "BX",                    icon: Shield,       emoji: "📦" },
  { href: "/modulos/carreta-kids",         label: "Carreta Kids",          icon: Ticket,       emoji: "🎠" },
  { href: "/modulos/locacao",              label: "Locação",               icon: Clock,        emoji: "📅" },
];

const businessModules = [
  { href: "/modulos/marketing",            label: "Marketing",             icon: Megaphone,    emoji: "📣" },
  { href: "/modulos/credito-financeiro",   label: "Crédito Financeiro",    icon: CreditCard,   emoji: "💳" },
  { href: "/modulos/mercado-autonomo",     label: "Mercado Autônomo",      icon: Store,        emoji: "🛒" },
  { href: "/modulos/plataforma-online",    label: "Plataforma Online",     icon: Globe,        emoji: "🌐" },
  { href: "/modulos/financas-pessoais",    label: "Finanças Pessoais",     icon: Notebook,     emoji: "📓" },
];

const managementLinks = [
  { href: "/clientes",   label: "Clientes",    description: "Cadastro e histórico",      icon: Users,            accent: "#60a5fa", accentBg: "bg-[#60a5fa]/15", accentText: "text-[#93c5fd]" },
  { href: "/financeiro", label: "Financeiro",  description: "Entradas, saídas e saldo",  icon: CircleDollarSign, accent: "#4ade80", accentBg: "bg-[#4ade80]/15", accentText: "text-[#86efac]" },
  { href: "/relatorio",  label: "Relatório",   description: "Resumo consolidado",        icon: BarChart2,        accent: "#2dd4bf", accentBg: "bg-[#2dd4bf]/15", accentText: "text-[#5eead4]" },
  { href: "/equipe",     label: "Equipe",      description: "Funcionários e permissões", icon: Users,            accent: "#a78bfa", accentBg: "bg-[#a78bfa]/15", accentText: "text-[#c4b5fd]" },
  { href: "/modulos",    label: "Todos os módulos", description: "Lista completa",       icon: LayoutGrid,       accent: "#d1a04f", accentBg: "bg-[#d1a04f]/15", accentText: "text-[#f3dfae]" },
];

export default async function PainelPage() {
  const session = await requireSession("DASHBOARD");

  if (session.role !== "OWNER") {
    redirect("/dashboard");
  }

  const [overview, alerts] = await Promise.all([
    getDashboardOverview(session),
    getPainelAlerts(session),
  ]);
  const totalIncome  = overview.metrics.find((m) => m.label.toLowerCase().includes("receb"))?.value ?? "—";
  const pendingEntry = overview.metrics.find((m) => m.label.toLowerCase().includes("pend"));
  const totalPending = pendingEntry?.value ?? "—";

  return (
    <div className="space-y-4">

      {/* Header */}
      <section className="rounded-2xl border border-[#d1a04f]/20 bg-[linear-gradient(135deg,rgba(17,22,20,0.95),rgba(209,160,79,0.1))] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9a958b]">Acesso exclusivo</p>
        <h1 className="mt-1 text-xl font-bold text-white">Painel do Dono</h1>
        <p className="mt-0.5 text-sm text-[#9a958b]">Controle total em um só lugar.</p>

        {/* Quick stats */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[#4ade80]/20 bg-[#4ade80]/8 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86efac]">A receber</p>
            <p className="mt-1 text-base font-bold text-[#86efac]">{totalIncome}</p>
          </div>
          <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/8 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#fca5a5]">Pendências</p>
            <p className="mt-1 text-base font-bold text-[#fca5a5]">{totalPending}</p>
          </div>
        </div>
      </section>

      {/* Alertas operacionais */}
      <div>
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9a958b]">Alertas</p>
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-2xl border p-3 ${alerts.overdueCount > 0 ? "border-[#f87171]/25 bg-[#f87171]/8" : "border-[rgba(245,241,232,0.08)] bg-white/[0.02]"}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${alerts.overdueCount > 0 ? "text-[#fca5a5]" : "text-[#5a544c]"}`}>Vencidas</p>
            <p className={`mt-1 text-lg font-bold ${alerts.overdueCount > 0 ? "text-[#f87171]" : "text-[#5a544c]"}`}>{alerts.overdueCount}</p>
            {alerts.overdueCount > 0 && (
              <p className="mt-0.5 text-[10px] text-[#fca5a5]/70">{formatCurrency(alerts.overdueTotal)}</p>
            )}
          </div>
          <div className={`rounded-2xl border p-3 ${alerts.todayVisitCount > 0 ? "border-[#4ade80]/20 bg-[#4ade80]/8" : "border-[rgba(245,241,232,0.08)] bg-white/[0.02]"}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${alerts.todayVisitCount > 0 ? "text-[#86efac]" : "text-[#5a544c]"}`}>Hoje</p>
            <p className={`mt-1 text-lg font-bold ${alerts.todayVisitCount > 0 ? "text-[#4ade80]" : "text-[#5a544c]"}`}>{alerts.todayVisitCount}</p>
            <p className="mt-0.5 text-[10px] text-[#9a958b]">visitas</p>
          </div>
          <div className={`rounded-2xl border p-3 ${alerts.unvisitedMachineCount > 0 ? "border-[#fb923c]/25 bg-[#fb923c]/8" : "border-[rgba(245,241,232,0.08)] bg-white/[0.02]"}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${alerts.unvisitedMachineCount > 0 ? "text-[#fdba74]" : "text-[#5a544c]"}`}>+15 dias</p>
            <p className={`mt-1 text-lg font-bold ${alerts.unvisitedMachineCount > 0 ? "text-[#fb923c]" : "text-[#5a544c]"}`}>{alerts.unvisitedMachineCount}</p>
            <p className="mt-0.5 text-[10px] text-[#9a958b]">pontos</p>
          </div>
        </div>
      </div>

      {/* Gestão */}
      <div>
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9a958b]">Gestão</p>
        <div className="overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35">
          {managementLinks.map((item, idx) => {
            const Icon = item.icon;
            const isLast = idx === managementLinks.length - 1;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-4 transition hover:bg-white/[0.03] active:scale-[0.99] ${!isLast ? "border-b border-[rgba(245,241,232,0.06)]" : ""}`}
              >
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${item.accentBg}`}>
                  <Icon className={`size-4 ${item.accentText}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[#9a958b]">{item.description}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-[#5a544c]" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Módulos de Campo */}
      <div>
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9a958b]">Módulos de campo</p>
        <div className="grid grid-cols-2 gap-2">
          {fieldModules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="flex items-center gap-3 rounded-2xl border border-[rgba(245,241,232,0.08)] bg-white/[0.025] px-4 py-4 transition hover:bg-white/[0.05] active:scale-[0.98]"
            >
              <span className="text-xl leading-none">{mod.emoji}</span>
              <span className="truncate text-sm font-medium text-[#c9c2b4]">{mod.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Módulos de Negócio */}
      <div>
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9a958b]">Módulos de negócio</p>
        <div className="overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/35">
          {businessModules.map((mod, idx) => {
            const isLast = idx === businessModules.length - 1;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className={`flex items-center gap-4 px-4 py-3.5 transition hover:bg-white/[0.03] active:scale-[0.99] ${!isLast ? "border-b border-[rgba(245,241,232,0.06)]" : ""}`}
              >
                <span className="text-lg leading-none">{mod.emoji}</span>
                <span className="flex-1 text-sm font-medium text-[#c9c2b4]">{mod.label}</span>
                <ChevronRight className="size-4 shrink-0 text-[#5a544c]" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Comprovantes */}
      <div className="overflow-hidden rounded-2xl border border-[#25d366]/20 bg-[#0d1f14]/60 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Receipt className="size-4 text-[#25d366]" />
            <div>
              <p className="text-sm font-semibold text-white">Comprovantes / WhatsApp</p>
              <p className="mt-0.5 text-xs text-[#9a958b]">Envio automático ativo em todos os módulos</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[#25d366]/35 bg-[#25d366]/10 px-2 py-0.5 text-[11px] font-semibold text-[#86efac]">
            Ativo
          </span>
        </div>
      </div>

    </div>
  );
}
