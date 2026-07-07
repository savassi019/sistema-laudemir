"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

export function SidebarLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "group rounded-2xl border px-4 py-3 transition-all",
        active
          ? "border-[#d1a04f]/35 bg-[#d1a04f]/12"
          : "border-[rgba(245,241,232,0.08)] bg-white/[0.02] hover:border-[rgba(245,241,232,0.15)] hover:bg-white/[0.05]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs leading-5 text-[#9a958b]">{description}</p>
        </div>
        <span
          className={cn(
            "mt-1 size-2 rounded-full",
            active ? "bg-[#d1a04f]" : "bg-white/20 group-hover:bg-white/40",
          )}
        />
      </div>
    </Link>
  );
}
