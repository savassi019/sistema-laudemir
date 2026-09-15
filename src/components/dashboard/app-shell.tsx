"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { primaryNavigation } from "@/lib/navigation";
import type { SessionData } from "@/types/app";

import { HeaderBrand } from "./header-brand";
import { LeftSidebar, SIDEBAR_STORAGE_KEY } from "./left-sidebar";
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

  /*
   * O estado da barra mora aqui, nao dentro dela: o conteudo precisa saber
   * se ela esta recolhida (60px) ou expandida (210px) para reservar o
   * espaco certo. Antes o conteudo sempre reservava 60px -- expandida, a
   * barra cobria 150px de tela por cima dele.
   */
  const [collapsed, setCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (v !== null) setCollapsed(v === "true");
    } catch {}
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }

  const sidebarCollapsed = !mounted || collapsed;

  return (
    <div className="relative flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(209,160,79,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(80,111,96,0.14),_transparent_25%),linear-gradient(180deg,#0b0f0e_0%,#101613_48%,#070908_100%)]">
      {/* Grid texture */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(245,241,232,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(245,241,232,0.028)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />

      {/* Left sidebar — desktop only */}
      <LeftSidebar
        session={session}
        navigation={navItems}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      {/* Content area: o padding acompanha a largura real da barra (60/210px),
          com a mesma duracao de transicao dela para nao dar um salto seco. */}
      <div
        className={cn(
          "relative flex min-w-0 flex-1 flex-col overflow-x-hidden transition-[padding] duration-200 ease-in-out",
          sidebarCollapsed ? "lg:pl-[60px]" : "lg:pl-[210px]",
        )}
      >
        {/* Top header */}
        <header className="sticky top-2 z-30 mx-3 mt-2 rounded-2xl border border-[rgba(245,241,232,0.11)] bg-[#101512]/90 p-2 shadow-[0_18px_46px_rgba(0,0,0,0.28)] backdrop-blur lg:mx-3 lg:mt-3">
          <div className="flex items-center justify-between gap-3">
            {/* Logo (mobile only — desktop has it in sidebar) + Brand */}
            <Link href="/" className="flex min-w-0 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/infinity-emblema.png" alt="Infinity" className="h-7 w-auto shrink-0 object-contain lg:hidden" />
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
