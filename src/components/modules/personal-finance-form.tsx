"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CalendarCheck2,
  LoaderCircle,
  NotebookTabs,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const schema = z.object({
  title: z.string().min(2, "Informe a descrição."),
  category: z.string().min(2, "Informe a categoria."),
  type: z.enum(["RECEITA", "DESPESA", "CONTA_A_PAGAR", "PAGO"]),
  amount: z.coerce.number().min(0, "Informe o valor."),
  dueDate: z.string().min(1, "Informe a data."),
  paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  title: string;
  category: string;
  type: string;
  amount: number;
  dueDate: string;
  paymentMethod: string;
  notes?: string;
};

const typeLabel: Record<FormValues["type"], string> = {
  RECEITA: "Receita",
  DESPESA: "Despesa",
  CONTA_A_PAGAR: "Conta a pagar",
  PAGO: "Pago",
};

export function PersonalFinanceForm({
  hideFinancials = false,
}: { hideFinancials?: boolean } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "DESPESA",
      amount: 0,
      paymentMethod: "PIX",
    },
  });

  const amount = Number(useWatch({ control: form.control, name: "amount" }) ?? 0);
  const type = String(
    useWatch({ control: form.control, name: "type" }) ?? "DESPESA",
  ) as FormValues["type"];
  const signedAmount = useMemo(() => {
    if (type === "RECEITA") {
      return amount;
    }

    return -amount;
  }, [amount, type]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/modules/financas-pessoais/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          category: values.category,
          type: values.type,
          amount: Number(values.amount),
          dueDate: values.dueDate,
          paymentMethod: values.paymentMethod,
          notes: values.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar o lancamento.");
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

    setReceipt({
      title: values.title,
      category: values.category,
      type: values.type,
      amount: values.amount,
      dueDate: values.dueDate,
      paymentMethod: values.paymentMethod,
      notes: values.notes,
    });

    setLoading(false);

    submittingRef.current = false;
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-[24px] border border-[#9b7b70]/25 bg-[#372b28]/70 p-4">
          <div className="flex items-center gap-2 text-[#ead0c7]">
            <NotebookTabs className="size-4" />
            <p className="font-medium">Finanças pessoais</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#ead0c7]/75">
            Receita, despesa, conta a pagar e nota rápida no mesmo lançamento.
          </p>
        </article>

        {hideFinancials ? null : (
          <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Impacto
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatCurrency(signedAmount)}
            </p>
            <p className="mt-1 text-sm text-slate-400">{typeLabel[type]}</p>
          </article>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass} htmlFor="title">
              Descrição
            </label>
            <input
              id="title"
              className={fieldClass}
              placeholder="Ex: Conta de energia"
              {...form.register("title")}
            />
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="type">
              Tipo
            </label>
            <select id="type" className={selectClass} {...form.register("type")}>
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
              <option value="CONTA_A_PAGAR">Conta a pagar</option>
              <option value="PAGO">Pago</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="category">
              Categoria
            </label>
            <input
              id="category"
              className={fieldClass}
              placeholder="Ex: Casa, empresa, imposto"
              {...form.register("category")}
            />
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
            <label className={labelClass} htmlFor="dueDate">
              Data / vencimento
            </label>
            <input
              id="dueDate"
              type="date"
              className={fieldClass}
              {...form.register("dueDate")}
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
            Nota / lembrete
          </label>
          <textarea
            id="notes"
            className={textareaClass}
            placeholder="Ex: lembrar de pagar antes do dia 10"
            {...form.register("notes")}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar lançamento
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
            <CalendarCheck2 className="size-4" />
            <p className="font-medium">Lançamento salvo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Descrição: {receipt.title}</p>
            <p>Categoria: {receipt.category}</p>
            <p>Tipo: {typeLabel[receipt.type as FormValues["type"]]}</p>
            <p>Data: {formatShortDate(receipt.dueDate)}</p>
            {hideFinancials ? null : <p>Valor: {formatCurrency(receipt.amount)}</p>}
            <p>Pagamento: {receipt.paymentMethod}</p>
          </div>
          {receipt.notes ? (
            <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p>
          ) : null}
          <WhatsAppReceiptButton
            message={[
              "*Comprovante Finanças Pessoais*",
              `Descrição: ${receipt.title}`,
              `Categoria: ${receipt.category}`,
              `Tipo: ${typeLabel[receipt.type as FormValues["type"]]}`,
              `*Valor: ${formatCurrency(receipt.amount)}*`,
              `Data: ${formatShortDate(receipt.dueDate)}`,
              `Pagamento: ${receipt.paymentMethod}`,
            ].join("\n")}
          />
        </article>
      ) : null}
    </div>
  );
}
