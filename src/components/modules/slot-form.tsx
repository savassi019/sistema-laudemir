"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";

const schema = z.object({
  uniqueMachineNumber: z.string().min(1, "Informe o numero unico."),
  clientSequenceNumber: z.string().min(1, "Informe a sequencia do cliente."),
  customerDebt: z.coerce.number().min(0),
  ppValue: z.coerce.number().min(0),
  initialAmount: z.coerce.number().min(0),
  initialAmountMode: z.enum(["NONE", "PIX", "DINHEIRO", "CARTAO"]),
  optionalGreedAmount: z.coerce.number().min(0),
  active: z.boolean().default(true),
  occurredAt: z.string().min(1, "Informe a data."),
  currentIncome: z.coerce.number().min(0),
  previousIncome: z.coerce.number().min(0),
  currentExpense: z.coerce.number().min(0),
  previousExpense: z.coerce.number().min(0),
  percentageSplit: z.coerce.number().min(0).max(100),
  conferenceCount: z.coerce.number().min(0),
  negativeAmount: z.coerce.number().min(0),
  feedingNegativeAmount: z.coerce.number().min(0),
  customerDebtDiscounted: z.coerce.number().min(0),
  generatedDebtAmount: z.coerce.number().min(0),
  debtMode: z.enum(["NONE", "MANUAL", "AUTO"]),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  uniqueMachineNumber: string;
  clientSequenceNumber: string;
  occurredAt: string;
  currentIncome: number;
  currentExpense: number;
  percentageSplit: number;
  splitAmount: number;
  houseAmount: number;
  conferenceCount: number;
  notes?: string;
};

export function SlotForm() {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      active: true,
      initialAmountMode: "NONE",
      debtMode: "NONE",
      percentageSplit: 50,
      customerDebt: 0,
      ppValue: 0,
      initialAmount: 0,
      optionalGreedAmount: 0,
      currentIncome: 0,
      previousIncome: 0,
      currentExpense: 0,
      previousExpense: 0,
      conferenceCount: 0,
      negativeAmount: 0,
      feedingNegativeAmount: 0,
      customerDebtDiscounted: 0,
      generatedDebtAmount: 0,
    },
  });

  const currentIncome = Number(useWatch({ control: form.control, name: "currentIncome" }) ?? 0);
  const currentExpense = Number(useWatch({ control: form.control, name: "currentExpense" }) ?? 0);
  const previousIncome = Number(useWatch({ control: form.control, name: "previousIncome" }) ?? 0);
  const previousExpense = Number(useWatch({ control: form.control, name: "previousExpense" }) ?? 0);
  const percentageSplit = Number(
    useWatch({ control: form.control, name: "percentageSplit" }) ?? 0,
  );
  const negativeAmount = Number(useWatch({ control: form.control, name: "negativeAmount" }) ?? 0);
  const feedingNegativeAmount =
    Number(useWatch({ control: form.control, name: "feedingNegativeAmount" }) ?? 0);
  const customerDebtDiscounted =
    Number(useWatch({ control: form.control, name: "customerDebtDiscounted" }) ?? 0);
  const generatedDebtAmount =
    Number(useWatch({ control: form.control, name: "generatedDebtAmount" }) ?? 0);

  const incomeDifference = useMemo(
    () => currentIncome - previousIncome,
    [currentIncome, previousIncome],
  );
  const expenseDifference = useMemo(
    () => currentExpense - previousExpense,
    [currentExpense, previousExpense],
  );
  const splitAmount = useMemo(
    () => currentIncome * (percentageSplit / 100),
    [currentIncome, percentageSplit],
  );
  const houseAmount =
    currentIncome -
    splitAmount -
    negativeAmount -
    feedingNegativeAmount -
    customerDebtDiscounted +
    generatedDebtAmount;

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    setReceipt({
      uniqueMachineNumber: values.uniqueMachineNumber,
      clientSequenceNumber: values.clientSequenceNumber,
      occurredAt: values.occurredAt,
      currentIncome,
      currentExpense,
      percentageSplit,
      splitAmount,
      houseAmount,
      conferenceCount: Number(values.conferenceCount),
      notes: values.notes,
    });

    setLoading(false);
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/[0.08] p-4 text-sm leading-6 text-amber-50">
        <p className="font-medium">Regra do H</p>
        <p>Controle entrada, saida, 50 por cento, divida, negativo e conferencias.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Entradas</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(currentIncome)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Casa</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(houseAmount)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Split</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(splitAmount)}</p>
        </article>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="uniqueMachineNumber">
              Numero unico da maquina
            </label>
            <input
              id="uniqueMachineNumber"
              className={fieldClass}
              {...form.register("uniqueMachineNumber")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="clientSequenceNumber">
              Sequencia do cliente
            </label>
            <input
              id="clientSequenceNumber"
              className={fieldClass}
              {...form.register("clientSequenceNumber")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="occurredAt">
              Data da conferencia
            </label>
            <input
              id="occurredAt"
              type="date"
              className={fieldClass}
              {...form.register("occurredAt")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="initialAmountMode">
              Modalidade do valor inicial
            </label>
            <select
              id="initialAmountMode"
              className={selectClass}
              {...form.register("initialAmountMode")}
            >
              <option value="NONE">Nenhum</option>
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO">Cartao</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="currentIncome">
              Receita atual
            </label>
            <input
              id="currentIncome"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("currentIncome")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="previousIncome">
              Receita anterior
            </label>
            <input
              id="previousIncome"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("previousIncome")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="currentExpense">
              Despesa atual
            </label>
            <input
              id="currentExpense"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("currentExpense")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="previousExpense">
              Despesa anterior
            </label>
            <input
              id="previousExpense"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("previousExpense")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="percentageSplit">
              Percentual do split
            </label>
            <input
              id="percentageSplit"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className={fieldClass}
              {...form.register("percentageSplit")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="conferenceCount">
              Conferencias
            </label>
            <input
              id="conferenceCount"
              type="number"
              min="0"
              className={fieldClass}
              {...form.register("conferenceCount")}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="negativeAmount">
              Valor negativo
            </label>
            <input
              id="negativeAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("negativeAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="feedingNegativeAmount">
              Negativo alimentado
            </label>
            <input
              id="feedingNegativeAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("feedingNegativeAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="customerDebtDiscounted">
              Divida descontada
            </label>
            <input
              id="customerDebtDiscounted"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("customerDebtDiscounted")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="generatedDebtAmount">
              Divida gerada
            </label>
            <input
              id="generatedDebtAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("generatedDebtAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="customerDebt">
              Divida do cliente
            </label>
            <input
              id="customerDebt"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("customerDebt")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="ppValue">
              Valor PP
            </label>
            <input
              id="ppValue"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("ppValue")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="initialAmount">
              Valor inicial
            </label>
            <input
              id="initialAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("initialAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="optionalGreedAmount">
              Greed opcional
            </label>
            <input
              id="optionalGreedAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("optionalGreedAmount")}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
          <input type="checkbox" {...form.register("active")} />
          Maquina ativa
        </label>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="debtMode">
            Modo da divida
          </label>
          <select id="debtMode" className={selectClass} {...form.register("debtMode")}>
            <option value="NONE">Nenhum</option>
            <option value="MANUAL">Manual</option>
            <option value="AUTO">Automatico</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="notes">
            Observacoes
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        <div className="rounded-[24px] border border-sky-400/20 bg-sky-400/[0.08] p-4">
          <div className="flex items-center gap-2 text-sky-100">
            <TriangleAlert className="size-4" />
            <p className="font-medium">Conferencia rapida</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-sky-100/80">
            Receita atual {formatCurrency(currentIncome)} | Diferenca {formatCurrency(incomeDifference)} |
            Despesa atual {formatCurrency(currentExpense)} | Diferenca {formatCurrency(expenseDifference)}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar H
          <ArrowRight className="size-4" />
        </button>
      </form>

      {receipt ? (
        <article className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/[0.08] p-5">
          <div className="flex items-center gap-2 text-emerald-100">
            <ReceiptText className="size-4" />
            <p className="font-medium">Registro do H salvo na base demo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-emerald-50/85 md:grid-cols-2">
            <p>Maquina: {receipt.uniqueMachineNumber}</p>
            <p>Cliente: {receipt.clientSequenceNumber}</p>
            <p>Data: {formatShortDate(receipt.occurredAt)}</p>
            <p>Conferencias: {receipt.conferenceCount}</p>
            <p>Split: {formatCurrency(receipt.splitAmount)}</p>
            <p>Casa: {formatCurrency(receipt.houseAmount)}</p>
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-emerald-50/75">{receipt.notes}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
