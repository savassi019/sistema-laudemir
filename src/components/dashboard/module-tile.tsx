import type { ComponentType } from "react";

import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  ChevronRight,
  Coins,
  Gift,
  Globe,
  Megaphone,
  NotebookTabs,
  Receipt,
  ShieldCheck,
  Store,
  Table2,
  Ticket,
  Users,
  WalletCards,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { ModuleCatalogItem, ModuleIconKey } from "@/lib/module-catalog";

const accentStyles = {
  slate:
    "border-[rgba(245,241,232,0.1)] bg-[linear-gradient(180deg,rgba(42,46,41,0.88),rgba(16,21,18,0.94))] text-white",
  emerald:
    "border-[#8aa17c]/22 bg-[linear-gradient(180deg,rgba(48,71,55,0.86),rgba(17,25,20,0.94))] text-white",
  amber:
    "border-[#d1a04f]/24 bg-[linear-gradient(180deg,rgba(73,51,27,0.86),rgba(24,18,12,0.94))] text-white",
  violet:
    "border-[#9b7b70]/22 bg-[linear-gradient(180deg,rgba(55,43,40,0.88),rgba(22,18,17,0.94))] text-white",
  blue: "border-[#6f8790]/22 bg-[linear-gradient(180deg,rgba(35,52,54,0.88),rgba(15,22,21,0.94))] text-white",
} as const;

const iconMap: Record<ModuleIconKey, ComponentType<{ className?: string }>> = {
  shield: ShieldCheck,
  ticket: Ticket,
  calendar: CalendarDays,
  table: Table2,
  gift: Gift,
  wallet: WalletCards,
  coins: Coins,
  badge: BadgeDollarSign,
  store: Store,
  megaphone: Megaphone,
  globe: Globe,
  users: Users,
  notebook: NotebookTabs,
  receipt: Receipt,
};

export function ModuleTile({ item }: { item: ModuleCatalogItem }) {
  const Icon = iconMap[item.icon];
  const disabled = !item.href;

  const content = (
    <div id={item.slug}>
      {/* Mobile: compact tappable row */}
      <article
        className={cn(
          "flex items-center gap-3 rounded-2xl border p-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] md:hidden",
          accentStyles[item.accent],
          disabled ? "opacity-70" : "",
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/15 text-white/90">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">{item.title}</p>
          <p className="truncate text-xs text-white/75">{item.summary}</p>
        </div>
        {disabled ? (
          <span className="shrink-0 rounded-full border border-white/12 bg-black/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-white/60">
            Em breve
          </span>
        ) : (
          <ChevronRight className="size-4 shrink-0 text-white/45" />
        )}
      </article>

      {/* Tablet/desktop: full card */}
      <article
        className={cn(
          "hidden min-h-[208px] flex-col rounded-2xl border p-5 shadow-[0_24px_60px_rgba(0,0,0,0.2)] md:flex",
          accentStyles[item.accent],
          disabled ? "opacity-75" : "",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="rounded-xl border border-white/15 bg-black/15 p-3 text-white/90">
            <Icon className="size-5" />
          </div>
          <span className="rounded-full border border-white/12 bg-black/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
            {item.stage}
          </span>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
          <p className="text-sm font-semibold text-white/90">{item.summary}</p>
          <p className="text-[13px] leading-5 text-white/78">{item.detail}</p>
        </div>
        <div className="mt-auto pt-5">
          {item.href ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#d1a04f] px-3 py-1.5 text-xs font-semibold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.28)]">
              Abrir
              <ArrowRight className="size-3.5" />
            </div>
          ) : (
            <div className="inline-flex rounded-full border border-white/12 bg-black/15 px-3 py-1.5 text-xs font-medium text-white/70">
              Em implantacao
            </div>
          )}
        </div>
      </article>
    </div>
  );

  if (item.href) {
    return <Link href={item.href}>{content}</Link>;
  }

  return content;
}
