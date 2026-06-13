import { ArrowLeftRight, ReceiptText } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireSession } from "@/lib/auth";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getFinanceOverview } from "@/server/services/finance-service";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireSession("FINANCE");
  const finance = await getFinanceOverview();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(16,185,129,0.14))] p-5 md:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Motor financeiro central
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Entradas, saidas, despesas, parciais e dividas no mesmo ledger.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              O modulo financeiro foi pensado para consolidar dados dos demais
              modulos, com filtros por periodo, anexos de comprovantes e status visual
              por tipo de liquidacao.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-5">
            <div className="mb-3 flex items-center gap-2 text-white">
              <ArrowLeftRight className="size-4 text-emerald-300" />
              <p className="font-medium">Regras consideradas</p>
            </div>
            <ul className="space-y-2 text-sm leading-6 text-slate-300">
              <li>Pagamentos parciais mantem saldo restante auditavel.</li>
              <li>Descontos e juros ficam separados do valor principal.</li>
              <li>Status visual diferencia pago, parcial, pendente e atrasado.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {finance.cards.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <SectionCard
        title="Lancamentos recentes"
        subtitle="Lista inicial do ledger financeiro pronta para filtros por data, modulo, cliente e status."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-300">
            <ReceiptText className="size-4" />
            Comprovantes preparados
          </div>
        }
      >
        <div className="grid gap-4 lg:hidden">
          {finance.entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-[24px] border border-white/8 bg-slate-950/55 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {entry.reference}
                  </p>
                  <h3 className="text-base font-semibold text-white">
                    {entry.description}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {entry.module}
                    {entry.customer ? ` - ${entry.customer}` : ""}
                  </p>
                </div>
                <StatusBadge label={entry.status} />
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Valor</span>
                  <span>{formatCurrency(entry.amount)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Pago</span>
                  <span>{formatCurrency(entry.paid)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Saldo</span>
                  <span>{formatCurrency(entry.remaining)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Vencimento</span>
                  <span>{formatShortDate(entry.dueDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Pagamento</span>
                  <span>{entry.method}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden grid gap-4 lg:grid">
          {finance.entries.map((entry) => (
            <article
              key={entry.id}
              className="grid gap-4 rounded-[26px] border border-white/8 bg-slate-950/55 p-5 lg:grid-cols-[1.2fr_0.8fr_0.8fr_160px]"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {entry.reference}
                  </p>
                  <StatusBadge label={entry.status} />
                </div>
                <h3 className="text-base font-semibold text-white">{entry.description}</h3>
                <p className="text-sm text-slate-400">
                  {entry.module}
                  {entry.customer ? ` - ${entry.customer}` : ""}
                </p>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <p>
                  <span className="text-slate-500">Valor:</span>{" "}
                  {formatCurrency(entry.amount)}
                </p>
                <p>
                  <span className="text-slate-500">Pago:</span>{" "}
                  {formatCurrency(entry.paid)}
                </p>
                <p>
                  <span className="text-slate-500">Saldo:</span>{" "}
                  {formatCurrency(entry.remaining)}
                </p>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <p>
                  <span className="text-slate-500">Vencimento:</span>{" "}
                  {formatShortDate(entry.dueDate)}
                </p>
                <p>
                  <span className="text-slate-500">Pagamento:</span> {entry.method}
                </p>
              </div>

              <div className="flex items-center justify-start lg:justify-end">
                <button className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08]">
                  Ver detalhes
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
