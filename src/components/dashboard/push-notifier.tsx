"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "lm_last_notif_date";

type Props = {
  alertCount: number;
  unvisitedCount: number;
  overdueContentCount: number;
  openRemindersCount: number;
};

export function PushNotifier({ alertCount, unvisitedCount, overdueContentCount, openRemindersCount }: Props) {
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission !== "granted") return;
    if (alertCount === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(STORAGE_KEY) === today) return;

    navigator.serviceWorker.ready.then((reg) => {
      const parts: string[] = [];
      if (unvisitedCount > 0)
        parts.push(`${unvisitedCount} cliente${unvisitedCount !== 1 ? "s" : ""} sem visita`);
      if (overdueContentCount > 0)
        parts.push(`${overdueContentCount} conteúdo${overdueContentCount !== 1 ? "s" : ""} atrasado${overdueContentCount !== 1 ? "s" : ""}`);
      if (openRemindersCount > 0)
        parts.push(`${openRemindersCount} cobrança${openRemindersCount !== 1 ? "s" : ""} em aberto`);

      reg.showNotification("Sistema Laudemir · Atenção necessária", {
        body: parts.join(" · "),
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: "/dashboard" },
        tag: "alertas-diarios",
      });

      localStorage.setItem(STORAGE_KEY, today);
    });
  }, [alertCount, unvisitedCount, overdueContentCount, openRemindersCount]);

  return null;
}

export function NotificationPermissionBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") setShow(true);
  }, []);

  if (!show) return null;

  function request() {
    Notification.requestPermission().then(() => setShow(false));
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#d1a04f]/25 bg-[#d1a04f]/8 px-4 py-3">
      <Bell className="size-4 shrink-0 text-[#f3dfae]" />
      <p className="flex-1 text-sm text-[#c9c2b4]">Ativar notificações para alertas do sistema</p>
      <button
        onClick={request}
        className="shrink-0 rounded-xl bg-[#d1a04f] px-3 py-1.5 text-xs font-semibold text-[#0d0a05] active:scale-95"
      >
        Ativar
      </button>
    </div>
  );
}
