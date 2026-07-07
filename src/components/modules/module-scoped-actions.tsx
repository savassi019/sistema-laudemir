"use client";

import { ClipboardCheck, ReceiptText, UserPlus, WalletCards, X } from "lucide-react";
import { useState } from "react";

import { formatCurrency } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";

type ActionType = "client" | "income" | "expense";

type SavedAction = {
  type: ActionType;
  title: string;
  value?: number;
};

const actions = [
  {
    type: "client" as const,
    label: "Cliente",
    helper: "Cadastrar neste modulo",
    icon: UserPlus,
  },
  {
    type: "income" as const,
    label: "Entrada",
    helper: "Recebimento do modulo",
    icon: WalletCards,
  },
  {
    type: "expense" as const,
    label: "Despesa",
    helper: "Custo separado",
    icon: ReceiptText,
  },
];

export function ModuleScopedActions({ moduleTitle }: { moduleTitle: string }) {
  const [active, setActive] = useState<ActionType | null>(null);
  const [savedAction, setSavedAction] = useState<SavedAction | null>(null);

  function handleSubmit(formData: FormData) {
    if (!active) {
      return;
    }

    const title = String(formData.get("title") ?? "").trim();
    const value = Number(formData.get("amount") ?? 0);

    if (!title) {
      return;
    }

    setSavedAction({
      type: active,
      title,
      value: active === "client" ? undefined : value,
    });
  }

  return (
    <div className="mt-3 space-y-3 border-t border-[rgba(245,241,232,0.08)] pt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Acoes do modulo</p>
        {active ? (
          <button
            type="button"
            onClick={() => setActive(null)}
            className="rounded-full border border-[rgba(245,241,232,0.1)] bg-white/[0.025] p-1.5 text-[#c9c2b4]"
            aria-label="Fechar acao"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const selected = active === action.type;

          return (
            <button
              key={action.type}
              type="button"
              onClick={() =>
                setActive((current) => (current === action.type ? null : action.type))
              }
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                selected
                  ? "border-[#d1a04f]/35 bg-[#d1a04f]/12 text-[#f3dfae]"
                  : "border-[rgba(245,241,232,0.1)] bg-white/[0.025] text-[#c9c2b4]"
              }`}
            >
              <Icon className="mb-1.5 size-4" />
              <span className="block text-xs font-semibold text-white">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {active ? (
        <form
          key={active}
          action={handleSubmit}
          className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#0b0f0e]/58 p-3"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor={`scope-${active}-title`}>
                {active === "client" ? "Nome do cliente" : "Descricao"}
              </label>
              <input
                id={`scope-${active}-title`}
                name="title"
                className={fieldClass}
                placeholder={
                  active === "client"
                    ? "Ex: Cliente do ponto 03"
                    : active === "income"
                      ? "Ex: Recebimento da rota"
                      : "Ex: Manutencao / combustivel"
                }
              />
            </div>

            {active === "client" ? (
              <div className="space-y-2">
                <label className={labelClass} htmlFor="scope-phone">
                  Telefone
                </label>
                <input
                  id="scope-phone"
                  name="phone"
                  className={fieldClass}
                  placeholder="(00) 00000-0000"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className={labelClass} htmlFor="scope-amount">
                  Valor
                </label>
                <input
                  id="scope-amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className={fieldClass}
                  defaultValue="0"
                />
              </div>
            )}

            {active !== "client" ? (
              <div className="space-y-2 md:col-span-2">
                <label className={labelClass} htmlFor="scope-status">
                  Status
                </label>
                <select id="scope-status" name="status" className={selectClass}>
                  <option value="PENDING">Pendente</option>
                  <option value="PARTIAL">Parcial</option>
                  <option value="PAID">Pago</option>
                </select>
              </div>
            ) : null}

            <div className="space-y-2 md:col-span-2">
              <label className={labelClass} htmlFor="scope-notes">
                Observacao
              </label>
              <textarea
                id="scope-notes"
                name="notes"
                className={`${textareaClass} min-h-[72px]`}
                placeholder={`Informacao de ${moduleTitle}`}
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#efe6d2] px-4 py-3 text-sm font-semibold text-[#15110b] transition hover:bg-[#fff3d8]"
          >
            <ClipboardCheck className="size-4" />
            Salvar no modulo
          </button>
        </form>
      ) : null}

      {savedAction ? (
        <div className="rounded-xl border border-[#8aa17c]/25 bg-[#243528]/72 p-3 text-sm text-[#dbe6d4]">
          <p className="font-semibold">Registro separado criado</p>
          <p className="mt-1 text-[#dbe6d4]/78">
            {savedAction.title}
            {savedAction.value !== undefined
              ? ` - ${formatCurrency(savedAction.value)}`
              : ""}{" "}
            em {moduleTitle}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
