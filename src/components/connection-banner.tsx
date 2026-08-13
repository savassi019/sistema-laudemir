"use client";

import { useEffect, useRef, useState } from "react";
import { WifiOff, ServerCrash, CheckCircle } from "lucide-react";

type Status = "online" | "offline" | "server-down";

const CHECK_INTERVAL_ONLINE  = 30_000; // 30s quando conectado
const CHECK_INTERVAL_OFFLINE = 10_000; // 10s quando sem conexão

export function ConnectionBanner() {
  const [status, setStatus] = useState<Status>("online");
  const [showRecovered, setShowRecovered] = useState(false);
  const prevStatus = useRef<Status>("online");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function pingServer(): Promise<Status> {
    if (!navigator.onLine) return "offline";
    try {
      const res = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const data = await res.json() as { ok?: boolean };
      return data.ok ? "online" : "server-down";
    } catch {
      return "server-down";
    }
  }

  function scheduleCheck(interval: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      const next = await pingServer();
      setStatus((prev) => {
        if (prev !== "online" && next === "online") {
          setShowRecovered(true);
          setTimeout(() => setShowRecovered(false), 4000);
        }
        prevStatus.current = next;
        return next;
      });
    }, interval);
  }

  useEffect(() => {
    // Initial check
    pingServer().then(setStatus);

    function handleOffline() {
      setStatus("offline");
      scheduleCheck(CHECK_INTERVAL_OFFLINE);
    }
    function handleOnline() {
      pingServer().then((s) => {
        setStatus(s);
        scheduleCheck(s === "online" ? CHECK_INTERVAL_ONLINE : CHECK_INTERVAL_OFFLINE);
      });
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    scheduleCheck(CHECK_INTERVAL_ONLINE);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            ? "Sem conexão — os dados digitados serão salvos quando a internet voltar."
            : "Servidor temporariamente indisponível — aguarde, tentando reconectar…"}
        </span>
      </div>
    </div>
  );
}
