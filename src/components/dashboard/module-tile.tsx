import type { ComponentType } from "react";

import Link from "next/link";
import {
  BadgeDollarSign,
  Coins,
  Gift,
  Globe,
  Megaphone,
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
    "border-white/10 bg-[linear-gradient(180deg,rgba(71,85,105,0.32),rgba(15,23,42,0.92))] text-white",
  emerald:
    "border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.28),rgba(6,78,59,0.9))] text-white",
  amber:
    "border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.25),rgba(120,53,15,0.92))] text-white",
  violet:
    "border-violet-400/20 bg-[linear-gradient(180deg,rgba(99,102,241,0.24),rgba(49,46,129,0.9))] text-white",
  blue: "border-sky-400/20 bg-[linear-gradient(180deg,rgba(37,99,235,0.24),rgba(30,64,175,0.9))] text-white",
} as const;

const iconMap: Record<ModuleIconKey, ComponentType<{ className?: string }>> = {
  shield: ShieldCheck,
  ticket: Ticket,
  table: Table2,
  gift: Gift,
  wallet: WalletCards,
  coins: Coins,
  badge: BadgeDollarSign,
  store: Store,
  megaphone: Megaphone,
  globe: Globe,
  users: Users,
  receipt: Receipt,
};

export function ModuleTile({ item }: { item: ModuleCatalogItem }) {
  const Icon = iconMap[item.icon];
  const content = (
    <article
      id={item.slug}
      className={cn(
        "flex min-h-[208px] flex-col rounded-[26px] border p-5 shadow-[0_24px_60px_rgba(2,6,23,0.2)]",
        accentStyles[item.accent],
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="rounded-2xl border border-white/15 bg-black/15 p-3 text-white/90">
          <Icon className="size-5" />
        </div>
        <span className="rounded-full border border-white/15 bg-black/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white/80">
          {item.stage}
        </span>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
        <p className="text-sm font-medium text-white/85">{item.summary}</p>
        <p className="text-sm leading-6 text-white/70">{item.detail}</p>
      </div>
      <div className="mt-auto pt-5">
        <div className="inline-flex rounded-full border border-white/15 bg-black/15 px-3 py-1 text-xs font-medium text-white/85">
          {item.href ? "Abrir modulo" : "Fluxo em implantacao"}
        </div>
      </div>
    </article>
  );

  if (item.href) {
    return <Link href={item.href}>{content}</Link>;
  }

  return content;
}
