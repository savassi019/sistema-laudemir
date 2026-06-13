"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleDollarSign,
  LayoutDashboard,
  LayoutGrid,
  Users,
} from "lucide-react";

import { cn } from "@/lib/cn";

const iconMap = {
  dashboard: LayoutDashboard,
  modules: LayoutGrid,
  clients: Users,
  finance: CircleDollarSign,
} as const;

export function ShellNavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: keyof typeof iconMap;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  const Icon = iconMap[icon];

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
        active
          ? "border-sky-400/30 bg-sky-400/12 text-sky-100"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  );
}
