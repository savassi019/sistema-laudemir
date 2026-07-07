"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0b0f0e] px-6 text-center text-[#f5f1e8]">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">O sistema encontrou um erro</h1>
          <p className="max-w-sm text-sm text-[#9a958b]">
            Nao foi possivel carregar a aplicacao. Tente novamente em alguns instantes.
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-[#d1a04f] px-4 py-2.5 text-sm font-semibold text-[#0d0a05] transition hover:bg-[#daa855]"
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
