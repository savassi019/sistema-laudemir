"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";

const schema = z.object({
  movementDate: z.string().min(1, "Informe a data."),
  description: z.string().min(2, "Informe a descricao."),
  direction: z.enum(["ENTRADA", "SAIDA"]),
  amount: z.coerce.number().min(0),
  expenseAmount: z.coerce.number().min(0),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  movementDate: string;
  description: string;
  direction: string;
  amount: number;
  expenseAmount: number;
  netAmount: number;
  notes?: string;
};

export function MarketEntryForm() {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: "ENTRADA",
      amount: 0,
      expenseAmount: 0,
    },
  });

  const amount = Number(useWatch({ control: form.control, name: "amount" }) ?? 0);
  const expenseAmount = Number(
    useWatch({ control: form.control, name: "expenseAmount" }) ?? 0,
  );
  const direction = String(
    useWatch({ control: form.control, name: "direction" }) ?? "ENTRADA",
  ) as "ENTRADA" | "SAIDA";
  const netAmount = useMemo(() => {
    if (direction === "SAIDA") {
      return -(amount + expenseAmount);
    }

    return amount - expenseAmount;
  }, [amount, expenseAmount, direction]);

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    setReceipt({
      movementDate: values.movementDate,
      description: values.description,
      direction: values.direction,
      amount,
      expenseAmount,
      netAmount,
      notes: values.notes,
    });

    setLoading(false);
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-violet-400/20 bg-violet-400/[0.08] p-4 text-sm leading-6 text-violet-50">
        <p className="font-medium">Mercado autonomo</p>
        <p>Entrada, saida, despesas e resultado liquido em um fluxo simples.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Movimento</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(amount)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Despesa</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(expenseAmount)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Liquido</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(netAmount)}</p>
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
            <label className={labelClass} htmlFor="direction">
              Direcao
            </label>
            <select id="direction" className={selectClass} {...form.register("direction")}>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saida</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass} htmlFor="description">
              Descricao
            </label>
            <input id="description" className={fieldClass} {...form.register("description")} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="amount">
              Valor principal
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("amount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="expenseAmount">
              Despesa
            </label>
            <input
              id="expenseAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("expenseAmount")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="notes">
            Observacoes
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        <div className="rounded-[24px] border border-sky-400/20 bg-sky-400/[0.08] p-4">
          <div className="flex items-center gap-2 text-sky-100">
            <Store className="size-4" />
            <p className="font-medium">Resultado rapido</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-sky-100/80">
            Direcao {direction === "ENTRADA" ? "de entrada" : "de saida"} com saldo {formatCurrency(netAmount)}.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar movimento
          <ArrowRight className="size-4" />
        </button>
      </form>

      {receipt ? (
        <article className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/[0.08] p-5">
          <div className="flex items-center gap-2 text-emerald-100">
            <ReceiptText className="size-4" />
            <p className="font-medium">Movimento salvo na base demo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-emerald-50/85 md:grid-cols-2">
            <p>Descricao: {receipt.description}</p>
            <p>Data: {formatShortDate(receipt.movementDate)}</p>
            <p>Direcao: {receipt.direction}</p>
            <p>Liquido: {formatCurrency(receipt.netAmount)}</p>
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-emerald-50/75">{receipt.notes}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
