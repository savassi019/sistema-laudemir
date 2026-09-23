"use client";

import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { registerModuleClientAction } from "@/server/actions/module-record-actions";

import { fieldClass, labelClass } from "./styles";

const slugsWithDocument = new Set(["bilhar-pebolim", "maquinas-de-pelucia", "bx", "h-caca-niquel", "locacao"]);
const slugsWithCity = new Set(["bilhar-pebolim", "bx", "h-caca-niquel"]);

export function ModuleClientRegistrationForm({
  slug,
  onSaved,
}: {
  slug: string;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      clientName: String(data.get("clientName") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      document: String(data.get("document") ?? "").trim(),
      localName: String(data.get("localName") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      tableModel: String(data.get("tableModel") ?? "").trim(),
      routeNumber: Number(data.get("routeNumber") ?? 1),
      chipValue: Number(data.get("chipValue") ?? 0),
      machineName: String(data.get("machineName") ?? "").trim(),
      machineNumber: String(data.get("machineNumber") ?? "").trim(),
      code: String(data.get("code") ?? "").trim(),
      machineCount: Number(data.get("machineCount") ?? 1),
      exceptionClient: data.get("exceptionClient") === "on",
    };

    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await registerModuleClientAction(slug, payload);
        form.reset();
        setSaved(true);
        router.refresh();
        window.setTimeout(onSaved, 700);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível cadastrar o cliente.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={labelClass}>Nome do cliente</span>
          <input name="clientName" required minLength={2} className={fieldClass} placeholder="Nome ou estabelecimento" />
        </label>
        <label className="space-y-1.5">
          <span className={labelClass}>Telefone</span>
          <input name="phone" type="tel" inputMode="tel" className={fieldClass} placeholder="(00) 00000-0000" />
        </label>

        {slugsWithDocument.has(slug) ? (
          <label className="space-y-1.5">
            <span className={labelClass}>CPF ou documento</span>
            <input name="document" inputMode="numeric" className={fieldClass} />
          </label>
        ) : null}

        {slug === "bilhar-pebolim" ? (
          <>
            <label className="space-y-1.5">
              <span className={labelClass}>Nome do ponto</span>
              <input name="localName" required className={fieldClass} placeholder="Ex.: Bar do Chico" />
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Modelo da mesa</span>
              <input name="tableModel" className={fieldClass} />
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Rota</span>
              <input name="routeNumber" type="number" inputMode="numeric" min="1" defaultValue="1" className={fieldClass} />
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Valor da ficha</span>
              <input name="chipValue" type="number" inputMode="decimal" min="0" step="0.01" defaultValue="0" className={fieldClass} />
            </label>
          </>
        ) : null}

        {slug === "maquinas-de-pelucia" ? (
          <>
            <label className="space-y-1.5">
              <span className={labelClass}>Nome da máquina (GRUA)</span>
              <input name="machineName" required className={fieldClass} placeholder="Ex.: Grua principal" />
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Número da máquina</span>
              <input name="machineNumber" required className={fieldClass} placeholder="Ex.: 12" />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className={labelClass}>Código da máquina</span>
              <input name="code" className={fieldClass} placeholder="Se ficar vazio, será criado automaticamente" />
            </label>
          </>
        ) : null}

        {slug === "h-caca-niquel" ? (
          <label className="space-y-1.5">
            <span className={labelClass}>Quantidade de máquinas</span>
            <input name="machineCount" type="number" inputMode="numeric" min="1" max="100" defaultValue="1" required className={fieldClass} />
          </label>
        ) : null}

        {slug === "carreta-kids" || slug === "locacao" ? (
          <label className="space-y-1.5">
            <span className={labelClass}>{slug === "carreta-kids" ? "Local de atendimento" : "Local padrão"}</span>
            <input name="localName" required className={fieldClass} />
          </label>
        ) : null}

        {slugsWithCity.has(slug) ? (
          <label className="space-y-1.5">
            <span className={labelClass}>Cidade</span>
            <input name="city" className={fieldClass} />
          </label>
        ) : null}
      </div>

      {slug === "bx" ? (
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 text-sm text-[#c9c2b4]">
          <input name="exceptionClient" type="checkbox" className="size-4 accent-[#d1a04f]" />
          Cliente exceção
        </label>
      ) : null}

      {error ? <p role="alert" className="rounded-xl border border-[#f87171]/25 bg-[#f87171]/10 px-3 py-2 text-sm text-[#fca5a5]">{error}</p> : null}
      {saved ? <p className="flex items-center gap-2 rounded-xl border border-[#4ade80]/25 bg-[#4ade80]/10 px-3 py-2 text-sm text-[#86efac]"><CheckCircle2 className="size-4" /> Cliente cadastrado.</p> : null}

      <button type="submit" disabled={isPending || saved} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#d1a04f] px-4 text-sm font-semibold text-[#0d0a05] disabled:opacity-60">
        {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        {isPending ? "Salvando..." : "Salvar cliente"}
      </button>
    </form>
  );
}
