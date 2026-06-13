import {
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Waves,
} from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/forms/login-form";
import { getSession } from "@/lib/auth";

const highlights = [
  {
    title: "Fluxo enxuto",
    description: "A equipe entra rapido, abre o modulo certo e trabalha sem excesso de tela.",
    icon: Waves,
  },
  {
    title: "Controle central",
    description: "Clientes, operacao e financeiro ficam juntos no mesmo painel modular.",
    icon: WalletCards,
  },
  {
    title: "Base pronta",
    description: "Login local, modulos dedicados e estrutura preparada para virar sistema real.",
    icon: ShieldCheck,
  },
];

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(249,115,22,0.16),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.14),_transparent_26%),linear-gradient(180deg,#020617_0%,#081120_42%,#0f172a_100%)] px-4 py-5 text-white md:px-6 md:py-8">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:68px_68px] opacity-30" />
      <div className="absolute left-1/2 top-12 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-400/12 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_480px]">
        <section className="hidden lg:block">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300">
              <Sparkles className="size-4 text-sky-300" />
              Sistema Laudemir
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-white">
                Login com cara de sistema serio, nao de tela provisoria.
              </h1>
              <p className="max-w-xl text-base leading-8 text-slate-300">
                O painel foi pensado para equipe de campo e gestao entrarem rapido,
                com leitura clara, hierarquia forte e uma interface mais limpa desde a
                primeira tela.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.8),rgba(15,23,42,0.46))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.26)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sky-200">
                        <Icon className="size-5" />
                      </div>
                      <ArrowUpRight className="size-4 text-slate-500" />
                    </div>
                    <h2 className="mt-5 text-lg font-semibold text-white">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {item.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="w-full rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.88))] p-5 shadow-[0_36px_120px_rgba(2,6,23,0.56)] backdrop-blur md:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-[22px] border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200 shadow-[0_0_0_6px_rgba(14,165,233,0.08)]">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-slate-500">
                  Acesso seguro
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Entrar no painel
                </h1>
              </div>
            </div>

            <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 sm:inline-flex">
              Demo local
            </div>
          </div>

          <div className="mb-6 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(15,23,42,0.12))] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">
              Ambiente de apresentacao
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              Selecione um perfil abaixo para preencher o acesso automatico ou entre
              manualmente com seu usuario.
            </p>
          </div>

          <LoginForm />
        </section>
      </div>
    </main>
  );
}
