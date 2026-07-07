"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0b0f0e] px-6 text-center text-[#f5f1e8]">
      <div className="flex size-16 items-center justify-center rounded-full border border-[#d1a04f]/30 bg-[#3a2b18]/60">
        <TriangleAlert className="size-7 text-[#d1a04f]" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="max-w-sm text-sm text-[#9a958b]">
          Tivemos uma falha inesperada nesta tela. Tente novamente ou volte para o painel.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-[#d1a04f] px-4 py-2.5 text-sm font-semibold text-[#0d0a05] transition hover:bg-[#daa855]"
        >
          <RotateCcw className="size-4" />
          Tentar de novo
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[rgba(245,241,232,0.15)] bg-white/[0.04] px-4 py-2.5 text-sm text-[#c9c2b4] transition hover:bg-white/[0.07]"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
