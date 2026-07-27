import type { ReactNode } from "react";

import Link from "next/link";
import { Layers3 } from "lucide-react";

import { primaryNavigation } from "@/lib/navigation";
import type { SessionData } from "@/types/app";

import { HeaderBrand } from "./header-brand";
import { LeftSidebar } from "./left-sidebar";
import { MobileNav } from "./mobile-nav";
import { OfflineBanner } from "./offline-banner";

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

  const navItems = visibleNavigation.map((item) => ({
    href: item.href,
    label: item.label,
  }));

  return (
    <div className="relative flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(209,160,79,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(80,111,96,0.14),_transparent_25%),linear-gradient(180deg,#0b0f0e_0%,#101613_48%,#070908_100%)]">
      {/* Grid texture */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(245,241,232,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(245,241,232,0.028)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />

      {/* Left sidebar — desktop only */}
      <LeftSidebar session={session} navigation={navItems} />

      {/* Content area — lg:pl-[60px] reserves space for the fixed collapsed sidebar */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden lg:pl-[60px]">
        {/* Top header */}
        <header className="sticky top-2 z-30 mx-3 mt-2 rounded-2xl border border-[rgba(245,241,232,0.11)] bg-[#101512]/90 p-2 shadow-[0_18px_46px_rgba(0,0,0,0.28)] backdrop-blur lg:mx-3 lg:mt-3">
          <div className="flex items-center justify-between gap-3">
            {/* Logo (mobile only — desktop has it in sidebar) + Brand */}
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-xl border border-[#d1a04f]/25 bg-[#d1a04f]/12 p-1.5 text-[#e7c783] lg:hidden">
                <Layers3 className="size-4" />
              </div>
              <HeaderBrand />
            </Link>

            {/* Mobile only: user info + logout */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="hidden text-right sm:block">
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

        <main className="min-w-0 overflow-x-hidden px-3 py-3 pb-24 lg:px-5 lg:py-4 lg:pb-4">
          {children}
        </main>

        <MobileNav role={session.role} />
        <OfflineBanner />
      </div>
    </div>
  );
}
