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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
        active
          ? "border-[#d1a04f]/35 bg-[#d1a04f]/12 text-[#f3dfae]"
          : "border-[rgba(245,241,232,0.1)] bg-white/[0.025] text-[#c9c2b4] hover:bg-white/[0.055]",
      )}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </Link>
  );
}
