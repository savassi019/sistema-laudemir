import type { ReactNode } from "react";

import Link from "next/link";
import { ClipboardCheck, FileBarChart2, Layers3, Users } from "lucide-react";

import { primaryNavigation } from "@/lib/navigation";
import type { SessionData } from "@/types/app";

import { HeaderBrand } from "./header-brand";
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
    <div className="relative min-h-screen max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(209,160,79,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(80,111,96,0.14),_transparent_25%),linear-gradient(180deg,#0b0f0e_0%,#101613_48%,#070908_100%)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(245,241,232,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(245,241,232,0.028)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />
      <div className="relative min-h-screen w-full max-w-full overflow-x-hidden px-3 py-2 pb-24 lg:px-5 lg:py-3 lg:pb-4">
        <header className="sticky top-2 z-40 rounded-2xl border border-[rgba(245,241,232,0.11)] bg-[#101512]/90 p-2 shadow-[0_18px_46px_rgba(0,0,0,0.28)] backdrop-blur lg:top-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-3 lg:shrink-0">
              <Link href="/" className="flex min-w-0 items-center gap-3">
                <div className="shrink-0 rounded-xl border border-[#d1a04f]/25 bg-[#d1a04f]/12 p-1.5 text-[#e7c783]">
                  <Layers3 className="size-4" />
                </div>
                <HeaderBrand />
              </Link>

              <div className="flex items-center gap-2">
                <div className="hidden text-right sm:block lg:hidden">
                  <p className="text-xs text-white">{session.name}</p>
                  <p className="text-[11px] text-[#9a958b]">
                    {session.role === "OWNER"
                      ? "Dono"
                      : session.role === "ADMIN"
                        ? "Administrador"
                        : "Funcionário"}
                  </p>
                </div>
                <form action="/api/auth/logout" method="post" className="lg:hidden">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl border border-[rgba(245,241,232,0.12)] bg-white/[0.035] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.06]"
                  >
                    Sair
                  </button>
                </form>
              </div>
            </div>

            <nav className="hidden gap-2 overflow-x-auto lg:flex lg:flex-1 lg:justify-center lg:overflow-visible">
              {session.role === "STAFF" && (
                <Link
                  href="/visita-rapida"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d1a04f]/40 bg-[#d1a04f]/14 px-3.5 py-1.5 text-sm font-semibold text-[#f3dfae] shadow-[0_0_12px_rgba(209,160,79,0.15)] transition hover:bg-[#d1a04f]/22"
                >
                  <ClipboardCheck className="size-3.5" />
                  Visita
                </Link>
              )}
              {(session.role === "OWNER" || session.role === "ADMIN") && (
                <>
                  <Link
                    href="/equipe"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(245,241,232,0.12)] bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-[#c9c2b4] transition hover:bg-white/[0.08]"
                  >
                    <Users className="size-3.5" />
                    Equipe
                  </Link>
                  <Link
                    href="/relatorio"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(245,241,232,0.12)] bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-[#c9c2b4] transition hover:bg-white/[0.08]"
                  >
                    <FileBarChart2 className="size-3.5" />
                    Relatório
                  </Link>
                </>
              )}
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

            <div className="hidden items-center gap-2 lg:flex lg:shrink-0">
              <div className="text-right">
                <p className="text-xs text-white">{session.name}</p>
                <p className="text-[11px] text-[#9a958b]">
                  {session.role === "OWNER"
                    ? "Dono"
                    : session.role === "ADMIN"
                      ? "Administrador"
                      : "Funcionário"}
                </p>
              </div>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl border border-[rgba(245,241,232,0.12)] bg-white/[0.035] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.06]"
                >
                  Sair
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="min-w-0 overflow-x-hidden py-3 lg:py-4">{children}</main>
      </div>
      <MobileNav role={session.role} />
    </div>
  );
}
