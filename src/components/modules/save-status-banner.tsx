"use client";

import { CheckCircle2, CloudUpload, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import {
  OFFLINE_SUBMISSION_EVENT,
  readOfflineSubmissions,
} from "@/lib/offline-submission-queue";

export type SaveStatus = "idle" | "saving" | "saved" | "queued" | "error";

const CONTENT = {
  saving: {
    icon: LoaderCircle,
    title: "Salvando no servidor...",
    detail: "Mantenha esta tela aberta ate a confirmacao.",
    style: "border-[#60a5fa]/30 bg-[#101d2b]/80 text-[#bfdbfe]",
  },
  saved: {
    icon: CheckCircle2,
    title: "Salvo no servidor",
    detail: "A operacao ja esta protegida e pode ser consultada no historico.",
    style: "border-[#4ade80]/30 bg-[#0e1c10]/80 text-[#bbf7d0]",
  },
  queued: {
    icon: CloudUpload,
    title: "Protegido neste aparelho",
    detail: "Esta operacao sera enviada automaticamente quando a internet voltar.",
    style: "border-[#fbbf24]/35 bg-[#2a2110]/80 text-[#fde68a]",
  },
  error: {
    icon: TriangleAlert,
    title: "Ainda nao foi salvo",
    detail: "Os dados continuam na tela. Confira a internet e toque em salvar novamente.",
    style: "border-[#fb7185]/35 bg-[#2b1519]/80 text-[#fecdd3]",
  },
} as const;

export function SaveStatusBanner({ status }: { status: SaveStatus }) {
  const [offlineQueueFinished, setOfflineQueueFinished] = useState(false);

  useEffect(() => {
    if (status !== "queued") return;
    let active = true;
    const refresh = async () => {
      try {
        const pending = await readOfflineSubmissions();
        if (active) setOfflineQueueFinished(pending.length === 0);
      } catch {
        // A fila global continua exibindo a falha de leitura. Aqui mantemos o
        // estado conservador de protegido, sem anunciar um envio inexistente.
      }
    };
    const handleQueueChange = () => void refresh();
    void refresh();
    window.addEventListener(OFFLINE_SUBMISSION_EVENT, handleQueueChange);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_SUBMISSION_EVENT, handleQueueChange);
    };
  }, [status]);

  if (status === "idle") return null;
  const visibleStatus = status === "queued" && offlineQueueFinished ? "saved" : status;
  const content = CONTENT[visibleStatus];
  const Icon = content.icon;

  return (
    <div
      role={visibleStatus === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn("flex items-start gap-3 rounded-2xl border p-3.5", content.style)}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black/15">
        <Icon className={cn("size-4", visibleStatus === "saving" && "animate-spin")} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{content.title}</p>
        <p className="mt-0.5 text-xs leading-5 opacity-80">{content.detail}</p>
      </div>
      {visibleStatus === "saving" ? <CloudUpload className="ml-auto mt-2 size-4 shrink-0 opacity-70" /> : null}
    </div>
  );
}
