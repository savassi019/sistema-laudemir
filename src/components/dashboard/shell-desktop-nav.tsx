"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, CircleDollarSign, FileBarChart2, LayoutDashboard, LayoutGrid, Users } from "lucide-react";

import { cn } from "@/lib/cn";
import type { SessionData } from "@/types/app";

type NavItem = { href: string; label: string };

const HIDDEN_ON_MODULE_DETAIL = new Set(["/clientes", "/financeiro", "/relatorio"]);

const iconFor = (href: string) => {
  if (href === "/dashboard") return LayoutDashboard;
  if (href === "/modulos") return LayoutGrid;
  if (href === "/clientes") return Users;
  if (href === "/financeiro") return CircleDollarSign;
  return LayoutDashboard;
};

const linkCls =
  "inline-flex items-center gap-1.5 rounded-full border border-[rgba(245,241,232,0.1)] bg-white/[0.025] px-3 py-1.5 text-sm font-medium text-[#c9c2b4] transition hover:bg-white/[0.055]";

const activeCls =
  "border-[#d1a04f]/35 bg-[#d1a04f]/12 text-[#f3dfae]";

export function ShellDesktopNav({
  session,
  navigation,
}: {
  session: SessionData;
  navigation: NavItem[];
}) {
  const pathname = usePathname();
  const isModuleDetail = /^\/modulos\/.+/.test(pathname);

  const visibleNav = isModuleDetail
    ? navigation.filter((item) => !HIDDEN_ON_MODULE_DETAIL.has(item.href))
    : navigation;

  return (
    <nav className="hidden gap-1.5 overflow-x-auto lg:flex lg:flex-1 lg:justify-center lg:overflow-visible">
      {session.role === "STAFF" && (
        <Link
          href="/visita-rapida"
          className={cn(
            linkCls,
            "border-[#d1a04f]/40 bg-[#d1a04f]/14 font-semibold text-[#f3dfae] shadow-[0_0_12px_rgba(209,160,79,0.15)]",
          )}
        >
          <ClipboardCheck className="size-3.5" />
          Visita
        </Link>
      )}
      {(session.role === "OWNER" || session.role === "ADMIN") && (
        <Link
          href="/equipe"
          className={cn(linkCls, pathname === "/equipe" && activeCls)}
        >
          <Users className="size-3.5" />
          Equipe
        </Link>
      )}
      {(session.role === "OWNER" || session.role === "ADMIN") && !isModuleDetail && (
        <Link
          href="/relatorio"
          className={cn(linkCls, pathname === "/relatorio" && activeCls)}
        >
          <FileBarChart2 className="size-3.5" />
          Relatório
        </Link>
      )}
      {visibleNav.map((item) => {
        const Icon = iconFor(item.href);
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(linkCls, active && activeCls)}
          >
            <Icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
