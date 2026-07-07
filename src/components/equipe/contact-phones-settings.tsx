"use client";

import { Check, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { fieldClass, labelClass } from "@/components/modules/styles";
import { setContactPhonesAction } from "@/server/actions/settings-actions";
import type { ContactPhones } from "@/server/services/settings-service";

export function ContactPhonesSettings({ initialPhones }: { initialPhones: ContactPhones }) {
  const [ownerPhone, setOwnerPhone] = useState(initialPhones.ownerPhone);
  const [staffPhone, setStaffPhone] = useState(initialPhones.staffPhone);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await setContactPhonesAction({ ownerPhone, staffPhone });
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-[#25d366]">
        <MessageCircle className="size-4" />
        <p className="text-sm font-semibold">Números fixos pro 2ª/3ª via do comprovante</p>
      </div>
      <p className="text-xs text-[#9a958b]">
        Usados nos módulos que enviam o comprovante 3 vezes (cliente, dono, equipe).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className={labelClass} htmlFor="ownerPhone">
            WhatsApp do dono
          </label>
          <input
            id="ownerPhone"
            type="tel"
            inputMode="tel"
            className={fieldClass}
            placeholder="(DDD) 9 9999-9999"
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className={labelClass} htmlFor="staffPhone">
            WhatsApp da equipe / central
          </label>
          <input
            id="staffPhone"
            type="tel"
            inputMode="tel"
            className={fieldClass}
            placeholder="(DDD) 9 9999-9999"
            value={staffPhone}
            onChange={(e) => setStaffPhone(e.target.value)}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d1a04f] px-4 py-2.5 text-sm font-semibold text-[#0d0a05] transition hover:bg-[#daa855] disabled:opacity-70"
      >
        {saved ? <Check className="size-4" /> : null}
        {isPending ? "Salvando..." : saved ? "Salvo" : "Salvar números"}
      </button>
    </form>
  );
}
