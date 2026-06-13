"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";

const schema = z
  .object({
    code: z.string().min(2, "Informe o codigo."),
    name: z.string().min(2, "Informe o nome."),
    machineNumber: z.string().min(1, "Informe o numero da maquina."),
    noteNumber: z.string().optional(),
    noteiroFixed: z.string().optional(),
    coinPhotoRule: z.boolean().default(true),
    giftPhotoRule: z.boolean().default(true),
    active: z.boolean().default(true),
    collectionDate: z.string().min(1, "Informe a data da coleta."),
    grossAmount: z.coerce.number().min(0),
    commissionPercentage: z.coerce.number().min(0).max(100),
    plushCountOut: z.coerce.number().min(0),
    paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
    discountAmount: z.coerce.number().min(0),
    discountReason: z.string().optional(),
    ownerExpenseAmount: z.coerce.number().min(0),
    compensationStatus: z.enum(["DRAFT", "OPEN", "CLOSED"]),
    noteiro: z.string().optional(),
    notes: z.string().optional(),
    coinPhoto: z.any().optional(),
    giftPhoto: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    const coinPhoto = data.coinPhoto?.[0] as File | undefined;
    const giftPhoto = data.giftPhoto?.[0] as File | undefined;

    if (data.coinPhotoRule && !coinPhoto) {
      ctx.addIssue({
        code: "custom",
        path: ["coinPhoto"],
        message: "Envie a foto das moedas.",
      });
    }

    if (data.giftPhotoRule && !giftPhoto) {
      ctx.addIssue({
        code: "custom",
        path: ["giftPhoto"],
        message: "Envie a foto dos brindes.",
      });
    }
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  code: string;
  name: string;
  machineNumber: string;
  collectionDate: string;
  grossAmount: number;
  clientAmount: number;
  companyAmount: number;
  netAmount: number;
  plushCountOut: number;
  paymentMethod: string;
  coinPhotoName?: string;
  giftPhotoName?: string;
  notes?: string;
};

export function PlushForm() {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      coinPhotoRule: true,
      giftPhotoRule: true,
      active: true,
      paymentMethod: "PIX",
      compensationStatus: "DRAFT",
      commissionPercentage: 25,
      discountAmount: 0,
      ownerExpenseAmount: 0,
      plushCountOut: 0,
    },
  });

  const grossAmount = Number(useWatch({ control: form.control, name: "grossAmount" }) ?? 0);
  const commissionPercentage =
    Number(useWatch({ control: form.control, name: "commissionPercentage" }) ?? 0);
  const discountAmount = Number(useWatch({ control: form.control, name: "discountAmount" }) ?? 0);
  const ownerExpenseAmount =
    Number(useWatch({ control: form.control, name: "ownerExpenseAmount" }) ?? 0);
  const coinPhotoRule = Boolean(
    useWatch({ control: form.control, name: "coinPhotoRule" }) ?? false,
  );
  const giftPhotoRule = Boolean(
    useWatch({ control: form.control, name: "giftPhotoRule" }) ?? false,
  );
  const clientAmount = useMemo(
    () => grossAmount * (commissionPercentage / 100),
    [grossAmount, commissionPercentage],
  );
  const companyAmount = grossAmount - clientAmount;
  const netAmount = companyAmount - discountAmount - ownerExpenseAmount;

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const coinPhoto = values.coinPhoto?.[0] as File | undefined;
    const giftPhoto = values.giftPhoto?.[0] as File | undefined;

    setReceipt({
      code: values.code,
      name: values.name,
      machineNumber: values.machineNumber,
      collectionDate: values.collectionDate,
      grossAmount,
      clientAmount,
      companyAmount,
      netAmount,
      plushCountOut: Number(values.plushCountOut),
      paymentMethod: values.paymentMethod,
      coinPhotoName: coinPhoto?.name,
      giftPhotoName: giftPhoto?.name,
      notes: values.notes,
    });

    setLoading(false);
  });

  const photoRuleText = [
    coinPhotoRule ? "foto de moedas obrigatoria" : "foto de moedas opcional",
    giftPhotoRule ? "foto de brindes obrigatoria" : "foto de brindes opcional",
  ].join(" | ");

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/[0.08] p-4 text-sm leading-6 text-emerald-50">
        <p className="font-medium">Regras da grua</p>
        <p>{photoRuleText}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Bruto</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(grossAmount)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cliente</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(clientAmount)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Casa</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(netAmount)}</p>
        </article>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="code">
              Codigo
            </label>
            <input id="code" className={fieldClass} {...form.register("code")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="name">
              Nome da maquina
            </label>
            <input id="name" className={fieldClass} {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="machineNumber">
              Numero da maquina
            </label>
            <input id="machineNumber" className={fieldClass} {...form.register("machineNumber")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="noteNumber">
              Numero do noteiro
            </label>
            <input id="noteNumber" className={fieldClass} {...form.register("noteNumber")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="noteiroFixed">
              Noteiro fixo
            </label>
            <input id="noteiroFixed" className={fieldClass} {...form.register("noteiroFixed")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="collectionDate">
              Data da coleta
            </label>
            <input
              id="collectionDate"
              type="date"
              className={fieldClass}
              {...form.register("collectionDate")}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="grossAmount">
              Total bruto
            </label>
            <input
              id="grossAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("grossAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="commissionPercentage">
              Comissao %
            </label>
            <input
              id="commissionPercentage"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className={fieldClass}
              {...form.register("commissionPercentage")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="plushCountOut">
              Quantidade de pelucia
            </label>
            <input
              id="plushCountOut"
              type="number"
              min="0"
              className={fieldClass}
              {...form.register("plushCountOut")}
            />
            <p className={hintClass}>Use para acompanhar saida e reposicao.</p>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="paymentMethod">
              Forma de pagamento
            </label>
            <select id="paymentMethod" className={selectClass} {...form.register("paymentMethod")}>
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO">Cartao</option>
              <option value="ABERTO">Aberto</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="discountAmount">
              Desconto
            </label>
            <input
              id="discountAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("discountAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="ownerExpenseAmount">
              Despesa do dono
            </label>
            <input
              id="ownerExpenseAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("ownerExpenseAmount")}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("coinPhotoRule")} />
            Foto de moedas obrigatoria
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("giftPhotoRule")} />
            Foto de brindes obrigatoria
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("active")} />
            Maquina ativa
          </label>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="compensationStatus">
              Status da compensacao
            </label>
            <select
              id="compensationStatus"
              className={selectClass}
              {...form.register("compensationStatus")}
            >
              <option value="DRAFT">Rascunho</option>
              <option value="OPEN">Aberto</option>
              <option value="CLOSED">Fechado</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="noteiro">
            Noteiro / observacao
          </label>
          <input id="noteiro" className={fieldClass} {...form.register("noteiro")} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="coinPhoto">
              Foto moedas
            </label>
            <input id="coinPhoto" type="file" className={fieldClass} {...form.register("coinPhoto")} />
            {form.formState.errors.coinPhoto ? (
              <p className="text-sm text-rose-300">
                {form.formState.errors.coinPhoto.message?.toString()}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="giftPhoto">
              Foto brindes
            </label>
            <input id="giftPhoto" type="file" className={fieldClass} {...form.register("giftPhoto")} />
            {form.formState.errors.giftPhoto ? (
              <p className="text-sm text-rose-300">
                {form.formState.errors.giftPhoto.message?.toString()}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="notes">
            Observacoes
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar Pelucia
          <ArrowRight className="size-4" />
        </button>
      </form>

      {receipt ? (
        <article className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/[0.08] p-5">
          <div className="flex items-center gap-2 text-emerald-100">
            <ReceiptText className="size-4" />
            <p className="font-medium">Registro da grua salvo na base demo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-emerald-50/85 md:grid-cols-2">
            <p>Maquina: {receipt.name}</p>
            <p>Codigo: {receipt.code}</p>
            <p>Numero: {receipt.machineNumber}</p>
            <p>Data: {formatShortDate(receipt.collectionDate)}</p>
            <p>Bruto: {formatCurrency(receipt.grossAmount)}</p>
            <p>Casa: {formatCurrency(receipt.netAmount)}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-50/75">
            <span>Pelucias: {receipt.plushCountOut}</span>
            <span>Pagamento: {receipt.paymentMethod}</span>
            {receipt.coinPhotoName ? <span>Foto moedas: {receipt.coinPhotoName}</span> : null}
            {receipt.giftPhotoName ? <span>Foto brindes: {receipt.giftPhotoName}</span> : null}
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-emerald-50/75">{receipt.notes}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
