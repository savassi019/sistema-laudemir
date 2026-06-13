import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function SectionCard({
  title,
  subtitle,
  action,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur",
        className,
      )}
    >
      {(title || subtitle || action) && (
        <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            {title ? (
              <h2 className="text-lg font-semibold tracking-tight text-white">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="max-w-2xl text-sm text-slate-300">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
