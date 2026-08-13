import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginThreeScene } from "@/components/auth/login-three-scene";
import { LoginForm } from "@/components/forms/login-form";
import { getSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/modulos");
  }

  return (
    <main className="login-screen relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-white">
      <LoginThreeScene />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#060d0a]/50 via-transparent to-[#060d0a]/35" />

      <section className="login-card relative z-10 w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/[0.09] bg-[#0d1210]/90 shadow-[0_40px_100px_rgba(0,0,0,0.55)] backdrop-blur-md">
        {/* Animated top accent line */}
        <div className="login-accent-line absolute inset-x-0 top-0 h-px" />

        {/* Inner top shine */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

        <div className="relative px-7 pb-7 pt-6">
          {/* Header */}
          <div className="login-form-step mb-8 flex items-start justify-between gap-4" style={{ animationDelay: "300ms" }}>
            <div className="flex items-center gap-4">
              <div className="login-icon-pulse login-icon-scan relative flex size-12 items-center justify-center rounded-2xl border border-[#d1a04f]/25 bg-[#d1a04f]/[0.11] text-[#d1a04f] shadow-[0_0_0_6px_rgba(209,160,79,0.06),0_0_20px_rgba(209,160,79,0.08)]">
                <ShieldCheck className="size-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase tracking-[0.36em] text-white/30">
                  Infinity ERP
                </p>
                <h1 className="text-xl font-semibold tracking-tight text-white/95">
                  Entrar no painel
                </h1>
                <p className="text-[11px] text-white/30">
                  Gestão operacional de campo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-[9px] font-medium uppercase tracking-widest text-emerald-400/80">Online</span>
            </div>
          </div>

          {/* Divider */}
          <div className="login-form-step mb-6 flex items-center gap-3" style={{ animationDelay: "420ms" }}>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.07]" />
            <span className="text-[9px] uppercase tracking-[0.3em] text-white/15">Identificação</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.07]" />
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}