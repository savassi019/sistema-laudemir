"use client";

import { useRef } from "react";

/**
 * Mantem a mesma chave enquanto um envio nao for confirmado pelo servidor.
 * Assim, um segundo toque ou uma repeticao causada pela internet nao cria
 * outra operacao. Uma nova chave so nasce depois de um salvamento concluido.
 */
export function useIdempotentSubmission() {
  const keyRef = useRef<string | null>(null);

  return {
    key() {
      keyRef.current ??= globalThis.crypto.randomUUID();
      return keyRef.current;
    },
    complete() {
      keyRef.current = null;
    },
  };
}
