"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleDollarSign,
  ClipboardCheck,
  FileBarChart2,
  LayoutDashboard,
  LayoutGrid,
  Users,
} from "lucide-react";

import { cn } from "@/lib/cn";

const ownerItems = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/modulos", label: "Módulos", icon: LayoutGrid },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/financeiro", label: "Financeiro", icon: CircleDollarSign },
  { href: "/relatorio", label: "Relatório", icon: FileBarChart2 },
] as const;

const staffItems = [
  { href: "/visita-rapida", label: "Visita", icon: ClipboardCheck },
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/modulos", label: "Módulos", icon: LayoutGrid },
] as const;

type Role = "OWNER" | "ADMIN" | "STAFF";

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = role === "STAFF" ? staffItems : ownerItems;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(245,241,232,0.1)] bg-[#0d120f]/95 px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] backdrop-blur lg:hidden">
      <div className={`mx-auto grid max-w-2xl gap-1.5 ${items.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const isVisit = item.href === "/visita-rapida";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-[11px] font-medium transition",
                active
                  ? "border-[#d1a04f]/35 bg-[#d1a04f]/12 text-[#f3dfae]"
                  : isVisit
                    ? "border-[#d1a04f]/20 bg-[#d1a04f]/8 text-[#d1a04f]"
                    : "border-[rgba(245,241,232,0.08)] bg-white/[0.025] text-[#c9c2b4]",
              )}
            >
              <Icon className={cn("size-4", isVisit && !active && "text-[#d1a04f]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
