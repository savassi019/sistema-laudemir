"use client";

import { CloudUpload, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  OFFLINE_SUBMISSION_EVENT,
  readOfflineSubmissions,
  syncOfflineSubmissions,
} from "@/lib/offline-submission-queue";

export function PendingSyncBanner() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(() => {
    setPending(readOfflineSubmissions().length);
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await syncOfflineSubmissions();
      setPending(result.pending);
      setError(result.lastError ?? null);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const handleChange = () => refreshCount();
    const handleOnline = () => void sync();
    window.addEventListener(OFFLINE_SUBMISSION_EVENT, handleChange);
    window.addEventListener("online", handleOnline);
    if (navigator.onLine) void sync();
    return () => {
      window.removeEventListener(OFFLINE_SUBMISSION_EVENT, handleChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [refreshCount, sync]);

  if (!pending) return null;

  return (
    <div className="fixed inset-x-3 bottom-[5.5rem] z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-[#d6a246]/40 bg-[#241d10]/95 p-3 text-[#f8dfae] shadow-2xl backdrop-blur lg:bottom-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#d6a246]/15">
        <CloudUpload className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {pending} {pending === 1 ? "registro aguardando envio" : "registros aguardando envio"}
        </p>
        <p className="truncate text-xs text-[#c8b991]">
          {error ?? "O envio acontece automaticamente quando a internet voltar."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void sync()}
        disabled={syncing}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#d6a246]/35 px-3 text-xs font-semibold active:bg-[#d6a246]/15 disabled:opacity-60"
      >
        {syncing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Enviar
      </button>
    </div>
  );
}
