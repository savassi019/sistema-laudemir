import type { ReactNode } from "react";

import Link from "next/link";
import { Layers3 } from "lucide-react";

import { primaryNavigation } from "@/lib/navigation";
import type { SessionData } from "@/types/app";

import { MobileNav } from "./mobile-nav";
import { ShellNavLink } from "./shell-nav-link";

export function AppShell({
  session,
  children,
}: {
  session: SessionData;
  children: ReactNode;
}) {
  const visibleNavigation = primaryNavigation.filter(
    (item) => session.role === "OWNER" || session.modules.includes(item.module),
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(52,211,153,0.12),_transparent_24%),linear-gradient(180deg,#08101f_0%,#0f172a_45%,#020617_100%)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
      <div className="relative mx-auto min-h-screen w-full max-w-[1600px] px-3 py-3 pb-28 lg:px-6 lg:py-4 lg:pb-4">
        <header className="sticky top-3 z-40 rounded-[28px] border border-white/10 bg-slate-950/80 p-4 shadow-[0_24px_60px_rgba(2,6,23,0.35)] backdrop-blur">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-3">
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-2.5 text-sky-200">
                  <Layers3 className="size-5" />
                </div>
                <div className="leading-tight">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-sky-200/70">
                    Sistema Base
                  </p>
                  <p className="text-sm font-semibold text-white">Gestao modular</p>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <p className="text-xs text-white">{session.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {session.role === "OWNER"
                      ? "Dono"
                      : session.role === "ADMIN"
                        ? "Administrador"
                        : "Funcionario"}
                  </p>
                </div>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white"
                  >
                    Sair
                  </button>
                </form>
              </div>
            </div>

            <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
              {visibleNavigation.map((item) => {
                const icon =
                  item.href === "/dashboard"
                    ? "dashboard"
                    : item.href === "/modulos"
                      ? "modules"
                    : item.href === "/clientes"
                      ? "clients"
                      : "finance";

                return (
                  <ShellNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={icon}
                  />
                );
              })}
            </nav>
          </div>
        </header>

        <main className="py-4 lg:py-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
