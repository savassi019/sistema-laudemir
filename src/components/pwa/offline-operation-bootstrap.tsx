"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { setOfflineSubmissionScope } from "@/lib/offline-submission-queue";
import type { ModuleName, SessionData } from "@/types/app";

const OPERATION_ROUTES: Array<{ module: ModuleName; route: string }> = [
  { module: "BILLIARD", route: "/modulos/bilhar-pebolim" },
  { module: "BX", route: "/modulos/bx" },
  { module: "CARRETA_KIDS", route: "/modulos/carreta-kids" },
  { module: "PLUSH", route: "/modulos/maquinas-de-pelucia" },
  { module: "RENTAL", route: "/modulos/locacao" },
  { module: "SLOT_H", route: "/modulos/h-caca-niquel" },
];

export function OfflineOperationBootstrap({ session }: { session: SessionData }) {
  const router = useRouter();

  useEffect(() => {
    const scope = `${session.organizationId}:${session.userId}`;
    const routes = [
      "/modulos",
      ...OPERATION_ROUTES
        .filter((item) => session.role === "OWNER" || session.modules.includes(item.module))
        .map((item) => item.route),
    ];
    setOfflineSubmissionScope(scope);

    if ("storage" in navigator && "persist" in navigator.storage) {
      void navigator.storage.persist().catch(() => false);
    }
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;
    const prefetchRoutes = (preparedRoutes: string[]) => {
      if (navigator.onLine) preparedRoutes.forEach((route) => router.prefetch(route));
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_OPERATIONS_READY" && Array.isArray(event.data.routes)) {
        prefetchRoutes(event.data.routes);
      }
    };
    const prepare = async () => {
      const registration = await navigator.serviceWorker.ready;
      if (disposed) return;
      registration.active?.postMessage({
        type: "PREPARE_OFFLINE_OPERATIONS",
        scope,
        routes,
      });
    };
    const handleControllerChange = () => void prepare();
    void prepare();
    navigator.serviceWorker.addEventListener("message", handleMessage);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [router, session.modules, session.organizationId, session.role, session.userId]);

  return null;
}
