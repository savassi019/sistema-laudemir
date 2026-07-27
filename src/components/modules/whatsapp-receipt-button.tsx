"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  defaultPhone?: string;
  message: string;
  title?: string;
  phoneLabel?: string;
  autoOpen?: boolean;
};

export function WhatsAppReceiptButton({
  defaultPhone = "",
  message,
  title = "Enviar comprovante pelo WhatsApp",
  phoneLabel = "Número do cliente",
  autoOpen = false,
}: Props) {
  const [phone, setPhone] = useState(defaultPhone);
  const [countdown, setCountdown] = useState<number | null>(null);
  const cancelledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageRef = useRef(message);
  messageRef.current = message;

  const isReady = phone.replace(/\D/g, "").length >= 10;

  function buildUrl(p: string) {
    const clean = p.replace(/\D/g, "");
    const withCountry = clean.startsWith("55") ? clean : `55${clean}`;
    return `https://wa.me/${withCountry}?text=${encodeURIComponent(messageRef.current)}`;
  }

  function handleSend() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCountdown(null);
    window.location.href = buildUrl(phone);
  }

  function handleCancel() {
    cancelledRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCountdown(null);
  }

  useEffect(() => {
    if (!autoOpen || !isReady || cancelledRef.current) return;

    const START = 3;
    setCountdown(START);
    let remaining = START;

    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        setCountdown(null);
        if (!cancelledRef.current) {
          window.location.href = buildUrl(phone);
        }
      } else {
        setCountdown(remaining);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#25d366]/30 bg-[#0d1f14]">
      <div className="flex items-center gap-2 border-b border-[#25d366]/15 px-4 py-3">
        <MessageCircle className="size-4 text-[#25d366]" />
        <p className="text-sm font-semibold text-[#25d366]">{title}</p>
      </div>

      {countdown !== null ? (
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-[#25d366]">
            Abrindo WhatsApp em <strong>{countdown}s</strong>…
          </p>
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#9a958b] transition hover:text-white"
          >
            <X className="size-3.5" />
            Cancelar
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs text-[#25d366]/60">{phoneLabel}</p>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(DDD) 9 9999-9999"
              className="w-full rounded-xl border border-[#25d366]/20 bg-white/[0.04] px-4 py-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-[#25d366]/50 focus:shadow-[0_0_0_3px_rgba(37,211,102,0.1)] transition"
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!isReady}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25d366] px-4 py-4 text-base font-bold text-[#0a1a10] shadow-[0_6px_20px_rgba(37,211,102,0.4)] transition hover:bg-[#22c55e] active:scale-[0.98] disabled:opacity-35 disabled:shadow-none"
          >
            <Send className="size-5" />
            Enviar comprovante agora
          </button>
        </div>
      )}
    </div>
  );
}
