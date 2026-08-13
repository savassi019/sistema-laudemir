"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileBarChart2,
  Layers3,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Shield,
  Users,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { SessionData } from "@/types/app";

type NavItem = { href: string; label: string };

const STORAGE_KEY = "lm-sidebar-collapsed";
const HIDDEN_ON_MODULE = new Set(["/clientes", "/financeiro", "/relatorio"]);

const ICON_MAP: Record<string, React.ElementType> = {
  "/dashboard": LayoutDashboard,
  "/modulos": LayoutGrid,
  "/clientes": Users,
  "/financeiro": CircleDollarSign,
  "/relatorio": FileBarChart2,
};

export function LeftSidebar({
  session,
  navigation,
}: {
  session: SessionData;
  navigation: NavItem[];
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v !== null) setCollapsed(v === "true");
    } catch {}
    return () => window.removeEventListener("resize", check);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }

  const isModuleDetail = /^\/modulos\/.+/.test(pathname);
  const filteredNav = isModuleDetail
    ? navigation.filter((n) => !HIDDEN_ON_MODULE.has(n.href))
    : navigation;

  const items: { href: string; label: string; Icon: React.ElementType; accent?: boolean }[] = [];

  if (session.role === "STAFF") {
    items.push({ href: "/visita-rapida", label: "Visita rápida", Icon: ClipboardCheck, accent: true });
  }
  if (session.role === "OWNER") {
    items.push({ href: "/painel", label: "Painel Dono", Icon: Shield });
  }
  if (session.role === "OWNER" || session.role === "ADMIN") {
    items.push({ href: "/equipe", label: "Equipe", Icon: Users });
    if (!isModuleDetail) {
      items.push({ href: "/relatorio", label: "Relatório", Icon: FileBarChart2 });
    }
  }
  for (const item of filteredNav) {
    const Icon = ICON_MAP[item.href] ?? LayoutDashboard;
    items.push({ href: item.href, label: item.label, Icon });
  }

  const isCollapsed = !mounted || collapsed;

  // Never render on mobile — JS guarentees this regardless of CSS
  if (!isDesktop) return null;

  return (
    <aside
      style={{ width: isCollapsed ? 60 : 210 }}
      className="fixed left-0 top-0 flex h-screen flex-col z-40 transition-[width] duration-200 ease-in-out border-r border-[rgba(245,241,232,0.07)] bg-[#090c0b]"
    >
      {/* Logo row */}
      <div className="flex h-14 shrink-0 items-center justify-between overflow-hidden border-b border-[rgba(245,241,232,0.07)] px-3">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="flex shrink-0 size-8 items-center justify-center rounded-xl border border-[#d1a04f]/25 bg-[#d1a04f]/12 text-[#e7c783]">
            <Layers3 className="size-4" />
          </div>
          {!isCollapsed && (
            <span className="truncate whitespace-nowrap text-sm font-semibold text-white">
              Infinity ERP
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          className="flex size-6 shrink-0 items-center justify-center rounded-lg text-[#9a958b] transition hover:bg-white/[0.06] hover:text-white"
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        <div className="space-y-0.5 px-2">
          {items.map(({ href, label, Icon, accent }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                title={isCollapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "border border-[#d1a04f]/25 bg-[#d1a04f]/12 text-[#f3dfae]"
                    : accent
                      ? "border border-[#d1a04f]/20 bg-[#d1a04f]/8 text-[#f3dfae] hover:bg-[#d1a04f]/15"
                      : "border border-transparent text-[#9a958b] hover:bg-white/[0.04] hover:text-[#c9c2b4]",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User + logout */}
      <div className="shrink-0 space-y-1.5 overflow-hidden border-t border-[rgba(245,241,232,0.07)] p-2">
        {!isCollapsed && (
          <div className="rounded-xl bg-white/[0.025] px-2.5 py-2">
            <p className="truncate text-xs font-medium text-white">{session.name}</p>
            <p className="text-[10px] text-[#9a958b]">
              {session.role === "OWNER" ? "Dono" : session.role === "ADMIN" ? "Admin" : "Funcionário"}
            </p>
          </div>
        )}
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            title={isCollapsed ? "Sair" : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.03]",
              "px-2.5 py-2 text-xs font-medium text-[#9a958b] transition hover:bg-white/[0.06] hover:text-white",
              isCollapsed ? "justify-center" : "",
            )}
          >
            <LogOut className="size-3.5 shrink-0" />
            {!isCollapsed && "Sair"}
          </button>
        </form>
      </div>
    </aside>
  );
}
