import { cn } from "@/lib/cn";

const toneMap = {
  ativo: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  inativo: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  inadimplente: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  excecao: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  pago: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  parcial: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  pendente: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  atrasado: "border-rose-400/30 bg-rose-400/10 text-rose-200",
} as const;

type StatusKey = keyof typeof toneMap;

export function StatusBadge({ label }: { label: StatusKey }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        toneMap[label],
      )}
    >
      {label.replace("_", " ")}
    </span>
  );
}
