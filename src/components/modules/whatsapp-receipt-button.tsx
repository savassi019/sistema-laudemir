"use client";

import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";

type Props = {
  defaultPhone?: string;
  message: string;
  title?: string;
  phoneLabel?: string;
};

export function WhatsAppReceiptButton({
  defaultPhone = "",
  message,
  title = "Enviar comprovante pelo WhatsApp",
  phoneLabel = "Número do cliente",
}: Props) {
  const [phone, setPhone] = useState(defaultPhone);

  function handleSend() {
    const clean = phone.replace(/\D/g, "");
    const withCountry = clean.startsWith("55") ? clean : `55${clean}`;
    window.open(
      `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  }

  const isReady = phone.replace(/\D/g, "").length >= 10;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#25d366]/30 bg-[#0d1f14]">
      <div className="flex items-center gap-2 border-b border-[#25d366]/15 px-4 py-3">
        <MessageCircle className="size-4 text-[#25d366]" />
        <p className="text-sm font-semibold text-[#25d366]">{title}</p>
      </div>
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
    </div>
  );
}
