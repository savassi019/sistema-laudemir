import { Sparkles } from "lucide-react";

import { ModuleTile } from "@/components/dashboard/module-tile";
import { requireSession } from "@/lib/auth";
import { getVisibleModulesFlat } from "@/lib/module-catalog";

export const dynamic = "force-dynamic";

export default async function ModulesPage() {
  const session = await requireSession("DASHBOARD");
  const items = getVisibleModulesFlat(session.modules);

  return (
    <div className="space-y-3 md:space-y-6">
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[linear-gradient(135deg,rgba(17,22,20,0.92),rgba(209,160,79,0.13))] p-3 md:rounded-[34px] md:p-6">
        <div className="hidden items-center gap-2 rounded-full border border-[rgba(245,241,232,0.12)] bg-white/[0.035] px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-[#c9c2b4] md:inline-flex">
          <Sparkles className="size-3.5" />
          Modulos do sistema
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-white md:mt-3 md:text-4xl">
          {session.role === "STAFF" ? "Escolha a rotina." : "Modulos de operacao."}
        </h1>
      </section>

      <div className="grid gap-2 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {items.map((item) => (
          <ModuleTile key={item.module} item={item} />
        ))}
      </div>
    </div>
  );
}
