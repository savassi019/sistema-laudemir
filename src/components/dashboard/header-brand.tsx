"use client";

import { usePathname } from "next/navigation";

import { getModuleBySlug, isModuleReady } from "@/lib/module-catalog";

export function HeaderBrand() {
  const pathname = usePathname();
  const moduleMatch = pathname?.match(/^\/modulos\/([^/]+)$/);
  const moduleItem = moduleMatch ? getModuleBySlug(moduleMatch[1]) : undefined;

  if (moduleItem) {
    return (
      <div className="leading-tight">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-white">{moduleItem.title}</p>
          <span className="shrink-0 rounded-full border border-[rgba(245,241,232,0.16)] bg-white/[0.05] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#c9c2b4]">
            {isModuleReady(moduleItem.slug) ? "Ativo" : "Pendente"}
          </span>
        </div>
        <p className="hidden truncate text-[11px] text-[#9a958b] sm:block">
          {moduleItem.detail}
        </p>
      </div>
    );
  }

  return (
    <div className="leading-tight">
      <p className="hidden text-[11px] uppercase tracking-[0.28em] text-[#d1a04f]/75 sm:block">
        Sistema Laudemir
      </p>
      <p className="text-sm font-semibold text-white">Sistema Laudemir</p>
    </div>
  );
}
