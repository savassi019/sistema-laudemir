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
        "rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.2)] backdrop-blur md:p-5",
        className,
      )}
    >
      {(title || subtitle || action) && (
        <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            {title ? (
              <h2 className="text-lg font-semibold tracking-tight text-white">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="max-w-2xl text-sm text-[#c9c2b4]">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
