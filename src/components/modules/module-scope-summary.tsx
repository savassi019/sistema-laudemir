import { ReceiptText, TrendingUp, Users, WalletCards } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import type { ModuleScopeSummary as ModuleScopeSummaryData } from "@/server/services/module-scope-service";
import { ModuleScopedActions } from "./module-scoped-actions";

const cards = [
  {
    key: "clientsCount",
    label: "Clientes",
    icon: Users,
    tone: "border-[#6f8790]/25 bg-[#27383a]/70 text-[#d6e1de]",
  },
  {
    key: "incomeAmount",
    label: "Entradas",
    icon: WalletCards,
    tone: "border-[#8aa17c]/25 bg-[#243528]/72 text-[#dbe6d4]",
  },
  {
    key: "expenseAmount",
    label: "Despesas",
    icon: ReceiptText,
    tone: "border-[#d1a04f]/28 bg-[#3a2b18]/72 text-[#f3dfae]",
  },
  {
    key: "balanceAmount",
    label: "Resultado",
    icon: TrendingUp,
    tone: "border-[#9b7b70]/25 bg-[#38211d]/72 text-[#efc6bc]",
  },
] as const;

function getValue(summary: ModuleScopeSummaryData, key: (typeof cards)[number]["key"]) {
  if (key === "clientsCount") {
    return String(summary.clientsCount);
  }

  return formatCurrency(summary[key]);
}

export function ModuleScopeSummary({
  moduleTitle,
  summary,
}: {
  moduleTitle: string;
  summary: ModuleScopeSummaryData;
}) {
  return (
    <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.16)] md:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#9a958b]">
            Separado por modulo
          </p>
          <h2 className="mt-1 truncate text-base font-semibold tracking-tight text-white">
            Clientes, entradas e despesas de {moduleTitle}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.key}
              className={`rounded-xl border p-3 ${card.tone}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium text-white/64">{card.label}</p>
                  <p className="mt-1 text-base font-semibold tracking-tight text-white md:text-lg">
                    {getValue(summary, card.key)}
                  </p>
                </div>
                <span className="rounded-lg border border-white/10 bg-black/20 p-1.5 text-white/62">
                  <Icon className="size-3.5" />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <ModuleScopedActions moduleTitle={moduleTitle} />
    </section>
  );
}
