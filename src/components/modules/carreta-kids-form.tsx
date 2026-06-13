"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Clock3, LoaderCircle, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";

const priceTable = {
  "15": 20,
  "30": 30,
  "60": 40,
} as const;

const schema = z.object({
  localName: z.string().min(2, "Informe o nome do local."),
  serviceDate: z.string().min(1, "Informe a data."),
  sheetName: z.string().min(2, "Informe o nome na ficha."),
  phone: z.string().min(8, "Informe um celular valido."),
  minutesCharged: z.enum(["15", "30", "60"]),
  paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "OUTRO"]),
  entryAmount: z.coerce.number().min(0),
  exitAmount: z.coerce.number().min(0),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  localName: string;
  serviceDate: string;
  sheetName: string;
  phone: string;
  minutesCharged: string;
  paymentMethod: string;
  baseValue: number;
  entryAmount: number;
  exitAmount: number;
  totalValue: number;
  notes?: string;
};

export function CarretaKidsForm() {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      minutesCharged: "15",
      paymentMethod: "PIX",
      entryAmount: 0,
      exitAmount: 0,
    },
  });

  const selectedMinutes = String(
    useWatch({ control: form.control, name: "minutesCharged" }) ?? "15",
  ) as keyof typeof priceTable;
  const baseValue = useMemo(
    () => priceTable[selectedMinutes],
    [selectedMinutes],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const totalValue = baseValue + Number(values.entryAmount) - Number(values.exitAmount);

    setReceipt({
      localName: values.localName,
      serviceDate: values.serviceDate,
      sheetName: values.sheetName,
      phone: values.phone,
      minutesCharged: values.minutesCharged,
      paymentMethod: values.paymentMethod,
      baseValue,
      entryAmount: Number(values.entryAmount),
      exitAmount: Number(values.exitAmount),
      totalValue,
      notes: values.notes,
    });
    setLoading(false);
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "15 min", value: formatCurrency(priceTable["15"]) },
          { label: "30 min", value: formatCurrency(priceTable["30"]) },
          { label: "1 hora", value: formatCurrency(priceTable["60"]) },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
          </article>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="localName">
              Nome do local
            </label>
            <input id="localName" className={fieldClass} {...form.register("localName")} />
            {form.formState.errors.localName ? (
              <p className="text-sm text-rose-300">
                {form.formState.errors.localName.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="serviceDate">
              Data
            </label>
            <input
              id="serviceDate"
              type="date"
              className={fieldClass}
              {...form.register("serviceDate")}
            />
            {form.formState.errors.serviceDate ? (
              <p className="text-sm text-rose-300">
                {form.formState.errors.serviceDate.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="sheetName">
              Nome na ficha
            </label>
            <input id="sheetName" className={fieldClass} {...form.register("sheetName")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="phone">
              Celular
            </label>
            <input id="phone" className={fieldClass} {...form.register("phone")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="minutesCharged">
              Tempo cobrado
            </label>
            <select id="minutesCharged" className={selectClass} {...form.register("minutesCharged")}>
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="paymentMethod">
              Forma de pagamento
            </label>
            <select id="paymentMethod" className={selectClass} {...form.register("paymentMethod")}>
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO">Cartao</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="entryAmount">
              Entrada no caixa
            </label>
            <input
              id="entryAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("entryAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="exitAmount">
              Saida no caixa
            </label>
            <input
              id="exitAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("exitAmount")}
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-sky-200/70">
                Valor calculado
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {formatCurrency(baseValue)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-sky-100">
              <Clock3 className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-sky-100/80">
            O total final considera entrada e saída de caixa, sem perder o valor
            da tabela.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar Carreta Kids
          <ArrowRight className="size-4" />
        </button>
      </form>

      {receipt ? (
        <article className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/[0.08] p-5">
          <div className="flex items-center gap-2 text-emerald-100">
            <ReceiptText className="size-4" />
            <p className="font-medium">Registro salvo na base demo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-emerald-50/85 md:grid-cols-2">
            <p>Local: {receipt.localName}</p>
            <p>Ficha: {receipt.sheetName}</p>
            <p>Data: {formatShortDate(receipt.serviceDate)}</p>
            <p>Pagamento: {receipt.paymentMethod}</p>
            <p>Valor da tabela: {formatCurrency(receipt.baseValue)}</p>
            <p>Total final: {formatCurrency(receipt.totalValue)}</p>
          </div>
          {receipt.notes ? (
            <p className="mt-3 text-sm text-emerald-50/75">{receipt.notes}</p>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
