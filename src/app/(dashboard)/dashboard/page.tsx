import {
  BellDot,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  UserPlus,
  WalletCards,
} from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { ModuleTile } from "@/components/dashboard/module-tile";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireSession } from "@/lib/auth";
import { formatLongDate } from "@/lib/format";
import { getVisibleModuleGroups } from "@/lib/module-catalog";
import { getDashboardOverview } from "@/server/services/dashboard-service";

export const dynamic = "force-dynamic";

const roleLabel = {
  OWNER: "Dono",
  ADMIN: "Administrador",
  STAFF: "Funcionario",
} as const;

const mobileOrder = ["field", "special", "transversal", "core", "business"] as const;

export default async function DashboardPage() {
  const session = await requireSession("DASHBOARD");
  const overview = await getDashboardOverview();
  const isFieldView = session.role === "STAFF";
  const openReminders = overview.reminders.filter(
    (reminder) => reminder.status === "aberto",
  );

  const visibleGroups = getVisibleModuleGroups(session.modules).sort((left, right) => {
    const leftIndex = mobileOrder.indexOf(left.key);
    const rightIndex = mobileOrder.indexOf(right.key);
    return leftIndex - rightIndex;
  });

  const quickActions = isFieldView
    ? [
        {
          href: "/clientes",
          title: "Cadastrar cliente",
          description: "Abrir cadastro, telefone, documento e excecao no mesmo fluxo.",
          icon: UserPlus,
          tone: "sky" as const,
        },
        {
          href: "/financeiro",
          title: "Lancamento rapido",
          description: "Registrar recebido, parcial, desconto ou saldo pendente.",
          icon: WalletCards,
          tone: "emerald" as const,
        },
        {
          href: "/modulos",
          title: "Operacao do dia",
          description: "Entrar nos modulos de campo liberados para o turno.",
          icon: ClipboardList,
          tone: "amber" as const,
        },
        {
          href: "/dashboard#agenda",
          title: "Ver pendencias",
          description: "Checar tarefas abertas antes de sair para rua.",
          icon: BellDot,
          tone: "rose" as const,
        },
      ]
    : [
        {
          href: "/financeiro",
          title: "Financeiro global",
          description: "Consolidado de entradas, saidas, parciais e contas a pagar.",
          icon: ChartColumn,
          tone: "sky" as const,
        },
        {
          href: "/clientes",
          title: "Base de clientes",
          description: "Historico, saldo, anexos e situacao de cada cadastro.",
          icon: UserPlus,
          tone: "emerald" as const,
        },
        {
          href: "/modulos",
          title: "Mapa de modulos",
          description: "Visualizar grupos do sistema e fases de entrega ativas.",
          icon: Sparkles,
          tone: "amber" as const,
        },
        {
          href: "/dashboard#estrategia",
          title: "Painel gerencial",
          description: "Acompanhar agenda, prioridades e arquitetura operacional.",
          icon: PhoneCall,
          tone: "rose" as const,
        },
      ];

  return (
    <div className="space-y-6">
      <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(15,118,110,0.2))] p-5 shadow-[0_32px_100px_rgba(2,6,23,0.4)] md:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
                <ShieldCheck className="size-4" />
                {isFieldView ? "Painel do funcionario" : "Painel de controle"}
              </div>
              <div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
                {roleLabel[session.role]}
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
                {isFieldView
                  ? "Fluxo rapido para atendimento, coleta e fechamento pelo celular."
                  : "Controle modular com operacao de campo, financeiro e crescimento por fases."}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-lg">
                {isFieldView
                  ? "A tela prioriza o que o funcionario realmente usa: abrir cliente, registrar valor, anexar comprovante e entrar nos modulos liberados."
                  : "A home combina leitura gerencial com uma estrutura enxuta para o celular, sem perder a visao de modulos, agenda, permissoes e consolidado."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Modulos ativos
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {session.modules.length}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  acesso liberado neste perfil
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Pendencias abertas
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {openReminders.length}
                </p>
                <p className="mt-1 text-sm text-slate-400">tarefas para o turno atual</p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Atualizacao
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {formatLongDate(new Date())}
                </p>
                <p className="mt-1 text-sm text-slate-400">base pronta para testes locais</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
            <div className="mb-4 flex items-center gap-2 text-white">
              <CalendarClock className="size-4 text-sky-300" />
              <p className="font-medium">Turno de hoje</p>
            </div>
            <div className="space-y-3">
              {openReminders.slice(0, 3).map((reminder) => (
                <article
                  key={reminder.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">{reminder.title}</h3>
                    <StatusBadge label="pendente" />
                  </div>
                  <p className="text-sm text-slate-300">
                    {reminder.owner} - {reminder.dueAt}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <QuickActionCard
            key={action.title}
            href={action.href}
            title={action.title}
            description={action.description}
            icon={action.icon}
            tone={action.tone}
          />
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {overview.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section id="modulos" className="space-y-5">
        {visibleGroups.map((group) => (
          <SectionCard
            key={group.key}
            title={group.title}
            subtitle={group.description}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <ModuleTile key={item.module} item={item} />
              ))}
            </div>
          </SectionCard>
        ))}
      </section>

      {isFieldView ? (
        <section id="agenda" className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <SectionCard
            title="Pendencias do turno"
            subtitle="Leitura rapida para nao deixar coleta, parcial ou retorno sem tratamento."
          >
            <div className="space-y-3">
              {overview.reminders.map((reminder) => (
                <article
                  key={reminder.id}
                  className="rounded-[24px] border border-white/8 bg-slate-950/60 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        {reminder.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">{reminder.owner}</p>
                    </div>
                    <StatusBadge label="pendente" />
                  </div>
                  <p className="text-sm text-slate-300">{reminder.dueAt}</p>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Regras que nao podem falhar"
            subtitle="Resumo operacional para manter padrao mesmo em atendimento rapido."
          >
            <div className="space-y-3">
              {[
                "Registrar parcial sempre com saldo restante visivel.",
                "Anexar comprovante e fotos obrigatorias conforme o modulo.",
                "Marcar excecao apenas quando a regra do cliente permitir.",
                "Usar clientes e financeiro como base de toda operacao.",
              ].map((item) => (
                <article
                  key={item}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300"
                >
                  {item}
                </article>
              ))}
            </div>
          </SectionCard>
        </section>
      ) : (
        <div
          id="estrategia"
          className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]"
        >
          <SectionCard
            title="Fluxo financeiro da semana"
            subtitle="Leitura rapida do comportamento de receitas e despesas para orientar o fechamento."
          >
            <RevenueChart data={overview.cashflow} />
          </SectionCard>

          <SectionCard
            title="Camadas estruturais"
            subtitle="Blocos mais importantes para crescer sem virar um sistema confuso."
          >
            <div className="space-y-3">
              {overview.spotlights.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[24px] border border-white/8 bg-slate-950/60 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-white">{item.title}</h3>
                    <StatusBadge
                      label={
                        item.tone === "success"
                          ? "ativo"
                          : item.tone === "warning"
                            ? "parcial"
                            : "pendente"
                      }
                    />
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{item.description}</p>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
