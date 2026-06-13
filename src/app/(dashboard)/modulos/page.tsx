import { Layers3, Sparkles } from "lucide-react";

import { ModuleTile } from "@/components/dashboard/module-tile";
import { SectionCard } from "@/components/ui/section-card";
import { requireSession } from "@/lib/auth";
import { getVisibleModuleGroups } from "@/lib/module-catalog";

export const dynamic = "force-dynamic";

export default async function ModulesPage() {
  const session = await requireSession("DASHBOARD");
  const groups = getVisibleModuleGroups(session.modules);

  return (
    <div className="space-y-6">
      <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(56,189,248,0.16))] p-5 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
              <Sparkles className="size-4" />
              Modulos do sistema
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
              {session.role === "STAFF"
                ? "Blocos liberados para o seu perfil."
                : "Todos os modulos organizados em uma unica tela."}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Toque em um bloco para abrir o formulario real do modulo. Aqui voce encontra
              Carreta Kids, Maquinas de Pelucia (Grua), Bilhar e Pebolim, BX, H, Credito
              financeiro, Mercado Autonomo, Marketing e Plataforma Online.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2 text-white">
              <Layers3 className="size-4 text-sky-300" />
              <p className="font-medium">Resumo</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-slate-500">Grupos</p>
                <p className="mt-1 text-lg font-semibold text-white">{groups.length}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-slate-500">Acesso</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {session.modules.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {groups.map((group) => (
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
    </div>
  );
}
