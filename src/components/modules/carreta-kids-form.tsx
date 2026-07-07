"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Clock3, LoaderCircle, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

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
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
  expenseAmount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

function minutesBetween(entryTime?: string, exitTime?: string): number | null {
  if (!entryTime || !exitTime) return null;
  const [entryHour, entryMinute] = entryTime.split(":").map(Number);
  const [exitHour, exitMinute] = exitTime.split(":").map(Number);
  if ([entryHour, entryMinute, exitHour, exitMinute].some(Number.isNaN)) return null;

  const entryTotal = entryHour * 60 + entryMinute;
  const exitTotal = exitHour * 60 + exitMinute;
  const diff = exitTotal - entryTotal;

  return diff >= 0 ? diff : null;
}

function suggestTier(minutes: number): "15" | "30" | "60" {
  if (minutes <= 15) return "15";
  if (minutes <= 30) return "30";
  return "60";
}

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
  entryTime?: string;
  exitTime?: string;
  expenseAmount: number;
  totalValue: number;
  notes?: string;
};

export function CarretaKidsForm({ hideFinancials = false }: { hideFinancials?: boolean } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const tierManuallySet = useRef(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      minutesCharged: "15",
      paymentMethod: "PIX",
      expenseAmount: 0,
    },
  });

  const selectedMinutes = String(
    useWatch({ control: form.control, name: "minutesCharged" }) ?? "15",
  ) as keyof typeof priceTable;
  const baseValue = useMemo(
    () => priceTable[selectedMinutes],
    [selectedMinutes],
  );

  const entryTime = useWatch({ control: form.control, name: "entryTime" });
  const exitTime = useWatch({ control: form.control, name: "exitTime" });
  const elapsedMinutes = useMemo(
    () => minutesBetween(entryTime, exitTime),
    [entryTime, exitTime],
  );

  useEffect(() => {
    if (tierManuallySet.current || elapsedMinutes === null) return;
    form.setValue("minutesCharged", suggestTier(elapsedMinutes));
  }, [elapsedMinutes, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    const totalValue = baseValue - Number(values.expenseAmount);

    try {
      const response = await fetch("/api/modules/carreta-kids/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localName: values.localName,
          serviceDate: values.serviceDate,
          sheetName: values.sheetName,
          phone: values.phone,
          minutesCharged: values.minutesCharged,
          paymentMethod: values.paymentMethod,
          entryTime: values.entryTime,
          exitTime: values.exitTime,
          expenseAmount: Number(values.expenseAmount),
          notes: values.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar a Carreta Kids.");
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

    setReceipt({
      localName: values.localName,
      serviceDate: values.serviceDate,
      sheetName: values.sheetName,
      phone: values.phone,
      minutesCharged: values.minutesCharged,
      paymentMethod: values.paymentMethod,
      baseValue,
      entryTime: values.entryTime,
      exitTime: values.exitTime,
      expenseAmount: Number(values.expenseAmount),
      totalValue,
      notes: values.notes,
    });
    setLoading(false);
    submittingRef.current = false;
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
              <p className="text-sm text-[#d59a8b]">
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
              <p className="text-sm text-[#d59a8b]">
                {form.formState.errors.serviceDate.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
              Cadastro de cliente
            </p>
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
            <label className={labelClass} htmlFor="entryTime">
              Horário de entrada
            </label>
            <input
              id="entryTime"
              type="time"
              className={fieldClass}
              {...form.register("entryTime")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="exitTime">
              Horário de saída
            </label>
            <input
              id="exitTime"
              type="time"
              className={fieldClass}
              {...form.register("exitTime")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="minutesCharged">
              Tempo cobrado
            </label>
            <select
              id="minutesCharged"
              className={selectClass}
              {...form.register("minutesCharged", {
                onChange: () => {
                  tierManuallySet.current = true;
                },
              })}
            >
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
            </select>
            {elapsedMinutes !== null ? (
              <p className="text-xs text-[#9a958b]">
                {elapsedMinutes} min entre entrada e saída — sugestão automática.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="paymentMethod">
              Forma de pagamento
            </label>
            <select id="paymentMethod" className={selectClass} {...form.register("paymentMethod")}>
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO">Cartão</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="expenseAmount">
              Despesa
            </label>
            <input
              id="expenseAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("expenseAmount")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="notes">
            Observações
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        {hideFinancials ? null : (
          <div className="rounded-[24px] border border-[#6f8790]/25 bg-[#27383a]/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#d6e1de]/70">
                  Valor calculado
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatCurrency(baseValue)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-[#d6e1de]">
                <Clock3 className="size-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#d6e1de]/80">
              O tempo cobrado é sugerido pelo horário de entrada/saída, mas pode ser ajustado manualmente.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar Carreta Kids
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
            <p className="font-medium">Registro salvo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Local: {receipt.localName}</p>
            <p>Ficha: {receipt.sheetName}</p>
            <p>Data: {formatShortDate(receipt.serviceDate)}</p>
            <p>Pagamento: {receipt.paymentMethod}</p>
            {receipt.entryTime ? <p>Entrada: {receipt.entryTime}</p> : null}
            {receipt.exitTime ? <p>Saída: {receipt.exitTime}</p> : null}
            {hideFinancials ? null : (
              <>
                <p>Valor da tabela: {formatCurrency(receipt.baseValue)}</p>
                <p>Despesa: {formatCurrency(receipt.expenseAmount)}</p>
                <p>Total final: {formatCurrency(receipt.totalValue)}</p>
              </>
            )}
          </div>
          {receipt.notes ? (
            <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p>
          ) : null}
          <WhatsAppReceiptButton
            defaultPhone={receipt.phone}
            message={[
              "*Comprovante Carreta Kids*",
              `Local: ${receipt.localName}`,
              `Ficha: ${receipt.sheetName}`,
              `Data: ${formatShortDate(receipt.serviceDate)}`,
              `Tempo: ${receipt.minutesCharged} min`,
              ...(receipt.entryTime ? [`Entrada: ${receipt.entryTime}`] : []),
              ...(receipt.exitTime ? [`Saída: ${receipt.exitTime}`] : []),
              `Pagamento: ${receipt.paymentMethod}`,
              `Despesa: ${formatCurrency(receipt.expenseAmount)}`,
              `*Total: ${formatCurrency(receipt.totalValue)}*`,
            ].join("\n")}
          />
        </article>
      ) : null}
    </div>
  );
}
