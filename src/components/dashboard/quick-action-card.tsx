import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

const toneStyles = {
  sky: "border-[#6f8790]/25 bg-[#27383a]/70 text-[#d6e1de]",
  emerald: "border-[#8aa17c]/25 bg-[#243528]/72 text-[#dbe6d4]",
  amber: "border-[#d1a04f]/28 bg-[#3a2b18]/72 text-[#f3dfae]",
  rose: "border-[#b46c5d]/25 bg-[#38211d]/72 text-[#efc6bc]",
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
        "rounded-2xl border p-3 shadow-[0_16px_36px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 md:p-4",
        toneStyles[tone],
      )}
    >
      <div className="mb-2.5 inline-flex rounded-xl border border-white/10 bg-black/15 p-2.5 md:mb-4 md:p-3">
        <Icon className="size-4 md:size-5" />
      </div>
      <h3 className="text-sm font-semibold text-white md:text-base">{title}</h3>
      <p className="mt-2 hidden text-sm leading-6 text-white/75 sm:block">
        {description}
      </p>
    </Link>
  );
}
