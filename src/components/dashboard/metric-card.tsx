import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/cn";
import type { DashboardMetric } from "@/types/app";

const toneStyles = {
  emerald:
    "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200 shadow-[0_20px_40px_rgba(16,185,129,0.12)]",
  amber:
    "border-amber-400/20 bg-amber-400/[0.08] text-amber-100 shadow-[0_20px_40px_rgba(245,158,11,0.12)]",
  rose:
    "border-rose-400/20 bg-rose-400/[0.08] text-rose-100 shadow-[0_20px_40px_rgba(244,63,94,0.12)]",
  sky: "border-sky-400/20 bg-sky-400/[0.08] text-sky-100 shadow-[0_20px_40px_rgba(56,189,248,0.12)]",
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
        "rounded-[24px] border p-5 transition-transform duration-200 hover:-translate-y-0.5",
        toneStyles[metric.tone],
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/70">{metric.label}</p>
          <h3 className="text-3xl font-semibold tracking-tight text-white">
            {metric.value}
          </h3>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 p-2 text-white/70">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="text-sm leading-6 text-white/65">{metric.helper}</p>
    </article>
  );
}
