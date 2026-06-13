import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers3, Sparkles } from "lucide-react";

import { BilliardForm } from "@/components/modules/billiard-form";
import { BxForm } from "@/components/modules/bx-form";
import { CarretaKidsForm } from "@/components/modules/carreta-kids-form";
import { MachineContractForm } from "@/components/modules/machine-contract-form";
import { MarketEntryForm } from "@/components/modules/market-entry-form";
import { MarketingContractForm } from "@/components/modules/marketing-contract-form";
import { PlatformOnlineForm } from "@/components/modules/platform-online-form";
import { PlushForm } from "@/components/modules/plush-form";
import { SlotForm } from "@/components/modules/slot-form";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireSession } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { getModuleBySlug, moduleCatalog } from "@/lib/module-catalog";

export const dynamic = "force-dynamic";

const formMap = {
  "carreta-kids": CarretaKidsForm,
  "maquinas-de-pelucia": PlushForm,
  "bx": BxForm,
  "bilhar-pebolim": BilliardForm,
  "h-caca-niquel": SlotForm,
  "credito-financeiro": MachineContractForm,
  "mercado-autonomo": MarketEntryForm,
  "marketing": MarketingContractForm,
  "plataforma-online": PlatformOnlineForm,
} as const;

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireSession("DASHBOARD");
  const { slug } = await params;
  const item = getModuleBySlug(slug);

  if (!item) {
    notFound();
  }

  if (session.role !== "OWNER" && !session.modules.includes(item.module)) {
    notFound();
  }

  const Form = formMap[item.slug as keyof typeof formMap];
  const isReady = Boolean(Form);

  const relatedModules = moduleCatalog.filter(
    (moduleItem) => moduleItem.module !== item.module,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(56,189,248,0.16))] p-5 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Link
              href="/modulos"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300"
            >
              <ArrowLeft className="size-4" />
              Voltar aos modulos
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                {item.title}
              </h1>
              <StatusBadge label={isReady ? "ativo" : "pendente"} />
            </div>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              {item.detail}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2 text-white">
              <Layers3 className="size-4 text-sky-300" />
              <p className="font-medium">Resumo rapido</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {item.summary}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">
              Atualizado em {formatShortDate(new Date())}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <SectionCard
          title="Formulario do modulo"
          subtitle={
            isReady
              ? "Preencha e salve um registro rapido. O retorno aparece logo abaixo para testar no celular."
              : "Modulo catalogado ainda sem formulario proprio. A base esta pronta para evoluir em seguida."
          }
        >
          {Form ? (
            <Form />
          ) : (
            <div className="rounded-[28px] border border-white/8 bg-slate-950/55 p-5 text-sm leading-7 text-slate-300">
              Este modulo ainda nao tem formulario especifico nesta etapa.
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Regras do modulo"
          subtitle="Referencia curta para o funcionario nao se perder no meio da operacao."
        >
          <div className="space-y-3">
            {[
              "Guardar fotos e comprovantes sempre que o fluxo pedir.",
              "Usar entrada e saida sem apagar o historico anterior.",
              "Marcar excecao apenas quando a regra do cliente permitir.",
              "Salvar tudo com o campo de status correto.",
            ].map((rule) => (
              <article
                key={rule}
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300"
              >
                {rule}
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Outros modulos"
        subtitle="A base ja esta preparada para os demais blocos do projeto."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-300">
            <Sparkles className="size-4" />
            Navegacao rapida
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {relatedModules.map((moduleItem) => (
            <Link
              key={moduleItem.slug}
              href={moduleItem.href ?? "/modulos"}
              className="rounded-[24px] border border-white/8 bg-slate-950/55 p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                {moduleItem.stage}
              </p>
              <h3 className="mt-2 text-base font-semibold text-white">
                {moduleItem.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {moduleItem.summary}
              </p>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
