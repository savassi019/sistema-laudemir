"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleDollarSign, LayoutDashboard, LayoutGrid, Users } from "lucide-react";

import { cn } from "@/lib/cn";

const items = [
  {
    href: "/dashboard",
    label: "Painel",
    icon: LayoutDashboard,
  },
  {
    href: "/modulos",
    label: "Modulos",
    icon: LayoutGrid,
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: Users,
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: CircleDollarSign,
  },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/92 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-4 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-3 text-xs font-medium transition",
                active
                  ? "border-sky-400/30 bg-sky-400/12 text-sky-200"
                  : "border-white/8 bg-white/[0.03] text-slate-300",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
