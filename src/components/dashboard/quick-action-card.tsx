import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

const toneStyles = {
  sky: "border-sky-400/20 bg-sky-400/[0.08] text-sky-100",
  emerald: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100",
  amber: "border-amber-400/20 bg-amber-400/[0.08] text-amber-100",
  rose: "border-rose-400/20 bg-rose-400/[0.08] text-rose-100",
} as const;

export function QuickActionCard({
  href,
  title,
  description,
  icon: Icon,
  tone,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: keyof typeof toneStyles;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-[24px] border p-4 shadow-[0_20px_50px_rgba(2,6,23,0.18)] transition hover:-translate-y-0.5",
        toneStyles[tone],
      )}
    >
      <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/15 p-3">
        <Icon className="size-5" />
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/75">{description}</p>
    </Link>
  );
}
