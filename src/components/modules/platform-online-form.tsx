"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText, Globe } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const schema = z.object({
  movementDate: z.string().min(1, "Informe a data."),
  description: z.string().min(2, "Informe a descrição."),
  direction: z.enum(["ENTRADA", "SAIDA"]),
  status: z.enum(["PENDING", "PAID", "POSTED"]),
  amount: z.coerce.number().min(0),
  paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  movementDate: string;
  description: string;
  direction: string;
  status: string;
  amount: number;
  netAmount: number;
  paymentMethod: string;
  notes?: string;
};

export function PlatformOnlineForm({
  hideFinancials = false,
}: { hideFinancials?: boolean } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: "ENTRADA",
      status: "PENDING",
      amount: 0,
      paymentMethod: "PIX",
    },
  });

  const amount = Number(useWatch({ control: form.control, name: "amount" }) ?? 0);
  const direction = String(
    useWatch({ control: form.control, name: "direction" }) ?? "ENTRADA",
  ) as "ENTRADA" | "SAIDA";
  const status = String(
    useWatch({ control: form.control, name: "status" }) ?? "PENDING",
  ) as "PENDING" | "PAID" | "POSTED";
  const netAmount = useMemo(() => (direction === "ENTRADA" ? amount : -amount), [amount, direction]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/modules/plataforma-online/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementDate: values.movementDate,
          description: values.description,
          direction: values.direction,
          status: values.status,
          amount: Number(values.amount),
          paymentMethod: values.paymentMethod,
          notes: values.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar a plataforma.");
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

    setReceipt({
      movementDate: values.movementDate,
      description: values.description,
      direction: values.direction,
      status: values.status,
      amount,
      netAmount,
      paymentMethod: values.paymentMethod,
      notes: values.notes,
    });

    setLoading(false);

    submittingRef.current = false;
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-[#6f8790]/25 bg-[#27383a]/70 p-4 text-sm leading-6 text-[#d6e1de]">
        <p className="font-medium">Plataforma online</p>
        <p>Movimentação enxuta para entrada, saída, status e fechamento do dia.</p>
      </div>

      <div className={`grid gap-3 ${hideFinancials ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>
        {hideFinancials ? null : (
          <>
            <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Valor</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(amount)}</p>
            </article>
            <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Líquido</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(netAmount)}</p>
            </article>
          </>
        )}
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</p>
          <p className="mt-2 text-xl font-semibold text-white">{status}</p>
        </article>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="movementDate">
              Data
            </label>
            <input
              id="movementDate"
              type="date"
              className={fieldClass}
              {...form.register("movementDate")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="status">
              Status
            </label>
            <select id="status" className={selectClass} {...form.register("status")}>
              <option value="PENDING">Pendente</option>
              <option value="PAID">Pago</option>
              <option value="POSTED">Lançado</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass} htmlFor="description">
              Descrição
            </label>
            <input id="description" className={fieldClass} {...form.register("description")} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="direction">
              Direção
            </label>
            <select id="direction" className={selectClass} {...form.register("direction")}>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="amount">
              Valor
            </label>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("amount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="paymentMethod">
              Forma de pagamento
            </label>
            <select id="paymentMethod" className={selectClass} {...form.register("paymentMethod")}>
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO">Cartão</option>
              <option value="ABERTO">Aberto</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="notes">
            Observações
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        {hideFinancials ? null : (
          <div className="rounded-[24px] border border-[#9b7b70]/25 bg-[#372b28]/70 p-4">
            <div className="flex items-center gap-2 text-[#ead0c7]">
              <Globe className="size-4" />
              <p className="font-medium">Resumo operacional</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#ead0c7]/80">
              Fluxo {direction === "ENTRADA" ? "positivo" : "negativo"} com saldo {formatCurrency(netAmount)}.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar plataforma
          <ArrowRight className="size-4" />
        </button>
      </form>

      {saveError ? (
        <div className="rounded-2xl border border-[#9d6b50]/35 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]">
          {saveError}
        </div>
      ) : null}

      {receipt ? (
        <article className="rounded-[28px] border border-[#8aa17c]/25 bg-[#243528]/72 p-5">
          <div className="flex items-center gap-2 text-[#dbe6d4]">
            <ReceiptText className="size-4" />
            <p className="font-medium">Registro online salvo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Descrição: {receipt.description}</p>
            <p>Data: {formatShortDate(receipt.movementDate)}</p>
            <p>Status: {receipt.status}</p>
            {hideFinancials ? null : <p>Líquido: {formatCurrency(receipt.netAmount)}</p>}
            <p>Pagamento: {receipt.paymentMethod}</p>
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p> : null}
          <WhatsAppReceiptButton
            message={[
              "*Comprovante Plataforma Online*",
              `Descrição: ${receipt.description}`,
              `Data: ${formatShortDate(receipt.movementDate)}`,
              `Direção: ${receipt.direction === "ENTRADA" ? "Entrada" : "Saída"}`,
              `Status: ${receipt.status}`,
              `*Valor: ${formatCurrency(receipt.amount)}*`,
              `*Líquido: ${formatCurrency(receipt.netAmount)}*`,
              `Pagamento: ${receipt.paymentMethod}`,
            ].join("\n")}
          />
        </article>
      ) : null}
    </div>
  );
}
