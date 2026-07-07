import { ArrowLeftRight, ReceiptText } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { FinanceEntries } from "@/components/financeiro/finance-entries";
import { SectionCard } from "@/components/ui/section-card";
import { requireSession } from "@/lib/auth";
import { getFinanceOverview } from "@/server/services/finance-service";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const session = await requireSession("FINANCE");
  const finance = await getFinanceOverview(session);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[rgba(245,241,232,0.1)] bg-[linear-gradient(135deg,rgba(17,22,20,0.9),rgba(138,161,124,0.13))] p-5 md:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[#9a958b]">
              Motor financeiro central
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Entradas, saídas, despesas, parciais e dívidas no mesmo ledger.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#c9c2b4] md:text-base">
              O módulo financeiro foi pensado para consolidar dados dos demais
              módulos, com filtros por período, anexos de comprovantes e status visual
              por tipo de liquidação.
            </p>
          </div>

          <div className="rounded-[28px] border border-[rgba(245,241,232,0.1)] bg-[#0b0f0e]/50 p-5">
            <div className="mb-3 flex items-center gap-2 text-white">
              <ArrowLeftRight className="size-4 text-[#d1a04f]" />
              <p className="font-medium">Regras consideradas</p>
            </div>
            <ul className="space-y-2 text-sm leading-6 text-[#c9c2b4]">
              <li>Pagamentos parciais mantêm saldo restante auditável.</li>
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
        title="Lançamentos recentes"
        subtitle="Lista inicial do ledger financeiro pronta para filtros por data, módulo, cliente e status."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-300">
            <ReceiptText className="size-4" />
            Comprovantes preparados
          </div>
        }
      >
        <FinanceEntries entries={finance.entries} />
      </SectionCard>
    </div>
  );
}
