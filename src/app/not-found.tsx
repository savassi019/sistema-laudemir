import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0b0f0e] px-6 text-center text-[#f5f1e8]">
      <div className="flex size-16 items-center justify-center rounded-full border border-[#d1a04f]/30 bg-[#3a2b18]/60">
        <Compass className="size-7 text-[#d1a04f]" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Pagina nao encontrada</h1>
        <p className="max-w-sm text-sm text-[#9a958b]">
          O endereco que voce acessou nao existe ou foi movido.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-xl bg-[#d1a04f] px-4 py-2.5 text-sm font-semibold text-[#0d0a05] transition hover:bg-[#daa855]"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}
