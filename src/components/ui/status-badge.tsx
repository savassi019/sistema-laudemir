import { cn } from "@/lib/cn";

const toneMap = {
  ativo: "border-[#8aa17c]/35 bg-[#8aa17c]/12 text-[#dbe6d4]",
  inativo: "border-[#9a958b]/30 bg-[#9a958b]/10 text-[#d8d0bf]",
  inadimplente: "border-[#b46c5d]/35 bg-[#b46c5d]/12 text-[#efc6bc]",
  excecao: "border-[#d1a04f]/35 bg-[#d1a04f]/12 text-[#f3dfae]",
  pago: "border-[#8aa17c]/35 bg-[#8aa17c]/12 text-[#dbe6d4]",
  parcial: "border-[#d1a04f]/35 bg-[#d1a04f]/12 text-[#f3dfae]",
  pendente: "border-[#9a958b]/30 bg-[#9a958b]/10 text-[#d8d0bf]",
  atrasado: "border-[#b46c5d]/35 bg-[#b46c5d]/12 text-[#efc6bc]",
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
