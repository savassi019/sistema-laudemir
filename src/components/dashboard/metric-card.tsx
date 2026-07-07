import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/cn";
import type { DashboardMetric } from "@/types/app";

const toneStyles = {
  emerald:
    "border-[#8aa17c]/25 bg-[#243528]/72 text-[#dbe6d4] shadow-[0_20px_40px_rgba(0,0,0,0.16)]",
  amber:
    "border-[#d1a04f]/28 bg-[#3a2b18]/72 text-[#f3dfae] shadow-[0_20px_40px_rgba(0,0,0,0.16)]",
  rose:
    "border-[#b46c5d]/25 bg-[#38211d]/72 text-[#efc6bc] shadow-[0_20px_40px_rgba(0,0,0,0.16)]",
  sky: "border-[#6f8790]/25 bg-[#27383a]/70 text-[#d6e1de] shadow-[0_20px_40px_rgba(0,0,0,0.16)]",
};

const icons = {
  emerald: ArrowUpRight,
  amber: Minus,
  rose: ArrowDownRight,
  sky: ArrowUpRight,
};

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = icons[metric.tone];

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 transition-transform duration-200 hover:-translate-y-0.5 md:p-5",
        toneStyles[metric.tone],
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3 md:mb-5 md:gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-white/70 md:text-sm">{metric.label}</p>
          <h3 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {metric.value}
          </h3>
        </div>
        <span className="rounded-xl border border-white/10 bg-black/20 p-2 text-white/70">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="hidden text-sm leading-6 text-white/65 sm:block">{metric.helper}</p>
    </article>
  );
}
