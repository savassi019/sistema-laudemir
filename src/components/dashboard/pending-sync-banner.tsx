"use client";

import { ChevronDown, CloudUpload, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  OFFLINE_SUBMISSION_EVENT,
  type OfflineSubmission,
  readOfflineSubmissions,
  syncOfflineSubmissions,
} from "@/lib/offline-submission-queue";

export function PendingSyncBanner({ scope }: { scope: string }) {
  const [items, setItems] = useState<OfflineSubmission[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshItems = useCallback(async () => {
    try {
      setItems(await readOfflineSubmissions(scope));
    } catch {
      setError("Nao foi possivel ler a fila protegida deste aparelho.");
    }
  }, [scope]);

  const sync = useCallback(async (manual = false) => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await syncOfflineSubmissions({
        retryAttention: manual,
        ignoreBackoff: manual,
        scope,
      });
      setError(result.lastError ?? null);
      await refreshItems();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshItems, scope]);

  useEffect(() => {
    // Sincroniza o estado React com a fila externa do IndexedDB ao montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshItems();
    const handleChange = () => void refreshItems();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === `${OFFLINE_SUBMISSION_EVENT}:pulse`) void refreshItems();
    };
    const handleOnline = () => void sync();
    const handleFocus = () => void sync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const timer = window.setInterval(() => {
      if (navigator.onLine) void sync();
    }, 60_000);

    window.addEventListener(OFFLINE_SUBMISSION_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    if (navigator.onLine) void sync();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(OFFLINE_SUBMISSION_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshItems, sync]);

  if (!items.length) return null;

  const attention = items.filter((item) => item.status === "attention").length;
  const pending = items.length - attention;
  const hasAttention = attention > 0;

  return (
    <aside className="fixed inset-x-3 bottom-[5.5rem] z-[190] mx-auto max-w-xl rounded-2xl border border-[#d6a246]/40 bg-[#18150f]/95 p-3 text-[#f8dfae] shadow-2xl backdrop-blur lg:bottom-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${hasAttention ? "bg-[#f87171]/15 text-[#fca5a5]" : "bg-[#d6a246]/15"}`}>
            {hasAttention ? <TriangleAlert className="size-5" /> : <CloudUpload className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {items.length} {items.length === 1 ? "operacao protegida" : "operacoes protegidas"}
            </p>
            <p className={`truncate text-xs ${hasAttention ? "text-[#fca5a5]" : "text-[#c8b991]"}`}>
              {hasAttention
                ? `${attention} precisa de conferencia antes do envio.`
                : error ?? `${pending} aguardando sincronizacao com o servidor.`}
            </p>
          </div>
          <ChevronDown className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => void sync(true)}
          disabled={syncing}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#d6a246]/35 px-3 text-xs font-semibold active:bg-[#d6a246]/15 disabled:opacity-50"
        >
          {syncing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Enviar
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 max-h-52 space-y-2 overflow-y-auto border-t border-white/10 pt-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-white">{item.label}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === "attention" ? "bg-[#f87171]/15 text-[#fca5a5]" : "bg-[#d6a246]/15 text-[#f8dfae]"}`}>
                  {item.status === "attention" ? "Conferir" : "Pendente"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#a99d85]">
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}
              </p>
              {item.lastError ? <p className="mt-1 text-[11px] leading-4 text-[#fca5a5]">{item.lastError}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
