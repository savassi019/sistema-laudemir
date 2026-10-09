"use client";

import { useEffect, useState } from "react";
import { WifiOff, ServerCrash, CheckCircle } from "lucide-react";

type Status = "online" | "offline" | "server-down";

const CHECK_INTERVAL_ONLINE  = 30_000; // 30s quando conectado
const CHECK_INTERVAL_RETRY = 3_000; // recupera rapido depois de uma falha
const SERVER_FAILURE_THRESHOLD = 2; // ignora um solavanco isolado de rede/deploy

export function ConnectionBanner() {
  const [status, setStatus] = useState<Status>("online");
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    let disposed = false;
    let currentStatus: Status = "online";
    let consecutiveServerFailures = 0;
    let checkTimer: ReturnType<typeof setTimeout> | null = null;
    let recoveredTimer: ReturnType<typeof setTimeout> | null = null;

    async function pingServer(): Promise<Status> {
      if (!navigator.onLine) return "offline";
      try {
        const res = await fetch("/api/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json() as { ok?: boolean };
        return data.ok ? "online" : "server-down";
      } catch {
        return "server-down";
      }
    }

    function showStatus(next: Status) {
      if (disposed || currentStatus === next) return;
      const recovered = currentStatus !== "online" && next === "online";
      currentStatus = next;
      setStatus(next);
      if (recovered) {
        setShowRecovered(true);
        if (recoveredTimer) clearTimeout(recoveredTimer);
        recoveredTimer = setTimeout(() => setShowRecovered(false), 4000);
      }
    }

    function scheduleCheck(delay: number) {
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(() => void checkConnection(), delay);
    }

    async function checkConnection() {
      const next = await pingServer();
      if (disposed) return;

      if (next === "online") {
        consecutiveServerFailures = 0;
        showStatus("online");
        scheduleCheck(CHECK_INTERVAL_ONLINE);
        return;
      }

      if (next === "offline") {
        consecutiveServerFailures = SERVER_FAILURE_THRESHOLD;
        showStatus("offline");
      } else {
        consecutiveServerFailures += 1;
        if (consecutiveServerFailures >= SERVER_FAILURE_THRESHOLD) {
          showStatus("server-down");
        }
      }
      scheduleCheck(CHECK_INTERVAL_RETRY);
    }

    function handleOffline() {
      consecutiveServerFailures = SERVER_FAILURE_THRESHOLD;
      showStatus("offline");
      scheduleCheck(CHECK_INTERVAL_RETRY);
    }
    function handleOnline() {
      consecutiveServerFailures = 0;
      scheduleCheck(0);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    scheduleCheck(0);

    return () => {
      disposed = true;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (checkTimer) clearTimeout(checkTimer);
      if (recoveredTimer) clearTimeout(recoveredTimer);
    };
  }, []);

  if (status === "online" && !showRecovered) return null;

  if (showRecovered) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-[#0d1e12]/95 px-4 py-2.5 text-sm font-medium text-emerald-400 shadow-xl backdrop-blur-sm">
          <CheckCircle className="size-4" />
          Conexão restabelecida
        </div>
      </div>
    );
  }

  const isOffline = status === "offline";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 text-sm font-medium ${
        isOffline
          ? "bg-[#1a0e00] text-amber-300 border-t border-amber-900/60"
          : "bg-[#1a0808] text-red-300 border-t border-red-900/60"
      }`}>
        {isOffline
          ? <WifiOff className="size-4 shrink-0" />
          : <ServerCrash className="size-4 shrink-0" />}
        <span>
          {isOffline
            ? "Modo offline — operações confirmadas ficam protegidas neste aparelho e serão enviadas quando a internet voltar."
            : "Servidor temporariamente indisponível — aguarde, tentando reconectar…"}
        </span>
      </div>
    </div>
  );
}
