"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const checkInitial = () => {
      if (!navigator.onLine) setOffline(true);
    };
    checkInitial();

    const handleOffline = () => {
      setOffline(true);
      setShowReconnected(false);
    };
    const handleOnline = () => {
      setOffline(false);
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline && !showReconnected) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 z-[200] -translate-x-1/2 whitespace-nowrap rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur lg:bottom-6 ${
        offline
          ? "border-[#f87171]/40 bg-[#1a0f0f]/90 text-[#fca5a5]"
          : "border-[#4ade80]/30 bg-[#0a1f0f]/90 text-[#86efac]"
      }`}
    >
      {offline ? (
        <span className="flex items-center gap-2">
          <WifiOff className="size-3.5" />
          Sem conexão — dados não serão salvos
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#4ade80]" />
          Conexão restabelecida
        </span>
      )}
    </div>
  );
}
