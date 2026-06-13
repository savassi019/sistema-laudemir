"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { formatCurrency } from "@/lib/format";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";

const schema = z
  .object({
    clientName: z.string().min(2, "Informe o cliente."),
    collectNumber: z.string().min(1, "Informe o recolhe."),
    agentName: z.string().min(2, "Informe o agente."),
    receiverName: z.string().min(2, "Informe quem recebeu."),
    occurredAt: z.string().min(1, "Informe a data e hora."),
    sentToAgentAmount: z.coerce.number().min(0),
    deliveredAmount: z.coerce.number().min(0),
    incomeAmount: z.coerce.number().min(0),
    expenseAmount: z.coerce.number().min(0),
    discountAmount: z.coerce.number().min(0),
    receiptStatus: z.enum(["RECEIVED", "NOT_RECEIVED"]),
    exceptionClient: z.boolean().default(false),
    screenPhoto: z.any().optional(),
    paperPhoto: z.any().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const screenPhoto = data.screenPhoto?.[0] as File | undefined;
    const paperPhoto = data.paperPhoto?.[0] as File | undefined;

    if (!data.exceptionClient) {
      if (!screenPhoto) {
        ctx.addIssue({
          code: "custom",
          path: ["screenPhoto"],
          message: "Envie a foto da tela.",
        });
      }

      if (!paperPhoto) {
        ctx.addIssue({
          code: "custom",
          path: ["paperPhoto"],
          message: "Envie a foto do papel.",
        });
      }
    } else if (!screenPhoto) {
      ctx.addIssue({
        code: "custom",
        path: ["screenPhoto"],
        message: "Cliente excecao precisa de pelo menos 1 foto.",
      });
    }
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  clientName: string;
  collectNumber: string;
  agentName: string;
  receiverName: string;
  occurredAt: string;
  sentToAgentAmount: number;
  deliveredAmount: number;
  incomeAmount: number;
  expenseAmount: number;
  discountAmount: number;
  netAmount: number;
  receiptStatus: string;
  exceptionClient: boolean;
  screenPhotoName?: string;
  paperPhotoName?: string;
  notes?: string;
};

export function BxForm() {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      receiptStatus: "NOT_RECEIVED",
      exceptionClient: false,
      sentToAgentAmount: 0,
      deliveredAmount: 0,
      incomeAmount: 0,
      expenseAmount: 0,
      discountAmount: 0,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const screenPhoto = values.screenPhoto?.[0] as File | undefined;
    const paperPhoto = values.paperPhoto?.[0] as File | undefined;
    const netAmount =
      Number(values.incomeAmount) -
      Number(values.expenseAmount) -
      Number(values.discountAmount);

    setReceipt({
      clientName: values.clientName,
      collectNumber: values.collectNumber,
      agentName: values.agentName,
      receiverName: values.receiverName,
      occurredAt: values.occurredAt,
      sentToAgentAmount: Number(values.sentToAgentAmount),
      deliveredAmount: Number(values.deliveredAmount),
      incomeAmount: Number(values.incomeAmount),
      expenseAmount: Number(values.expenseAmount),
      discountAmount: Number(values.discountAmount),
      netAmount,
      receiptStatus: values.receiptStatus,
      exceptionClient: values.exceptionClient,
      screenPhotoName: screenPhoto?.name,
      paperPhotoName: paperPhoto?.name,
      notes: values.notes,
    });

    setLoading(false);
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/[0.08] p-4 text-sm leading-6 text-amber-50">
        <p className="font-medium">Regra do BX</p>
        <p>
          Recebido fica verde. Nao recebido fica vermelho. Cliente excecao pode
          trabalhar com 1 foto apenas.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="clientName">
              Cliente
            </label>
            <input id="clientName" className={fieldClass} {...form.register("clientName")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="collectNumber">
              Recolhe 1
            </label>
            <input
              id="collectNumber"
              className={fieldClass}
              {...form.register("collectNumber")}
            />
            <p className={hintClass}>Numero do recolhe para controle da operacao.</p>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="agentName">
              Mandou para agente
            </label>
            <input id="agentName" className={fieldClass} {...form.register("agentName")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="receiverName">
              Levou cliente recebeu
            </label>
            <input
              id="receiverName"
              className={fieldClass}
              {...form.register("receiverName")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="occurredAt">
              Data e hora
            </label>
            <input
              id="occurredAt"
              type="datetime-local"
              className={fieldClass}
              {...form.register("occurredAt")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="receiptStatus">
              Situcao do recebimento
            </label>
            <select
              id="receiptStatus"
              className={selectClass}
              {...form.register("receiptStatus")}
            >
              <option value="RECEIVED">Recebido</option>
              <option value="NOT_RECEIVED">Nao recebido</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="sentToAgentAmount">
              Mandou para agente recebe
            </label>
            <input
              id="sentToAgentAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("sentToAgentAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="deliveredAmount">
              Levou cliente recebeu
            </label>
            <input
              id="deliveredAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("deliveredAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="incomeAmount">
              Entradas
            </label>
            <input
              id="incomeAmount"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("incomeAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="expenseAmount">
              Saidas
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="screenPhoto">
              Foto da tela
            </label>
            <input
              id="screenPhoto"
              type="file"
              className={fieldClass}
              {...form.register("screenPhoto")}
            />
            {form.formState.errors.screenPhoto ? (
              <p className="text-sm text-rose-300">
                {form.formState.errors.screenPhoto.message?.toString()}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="paperPhoto">
              Foto do papel
            </label>
            <input
              id="paperPhoto"
              type="file"
              className={fieldClass}
              {...form.register("paperPhoto")}
            />
            {form.formState.errors.paperPhoto ? (
              <p className="text-sm text-rose-300">
                {form.formState.errors.paperPhoto.message?.toString()}
              </p>
            ) : null}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
          <input type="checkbox" {...form.register("exceptionClient")} />
          Cliente excecao
        </label>

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
          Salvar BX
          <ArrowRight className="size-4" />
        </button>
      </form>

      {receipt ? (
        <article className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/[0.08] p-5">
          <div className="flex items-center gap-2 text-emerald-100">
            <ReceiptText className="size-4" />
            <p className="font-medium">Registro BX pronto</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-emerald-50/85 md:grid-cols-2">
            <p>Cliente: {receipt.clientName}</p>
            <p>Recolhe: {receipt.collectNumber}</p>
            <p>Agente: {receipt.agentName}</p>
            <p>Recebeu: {receipt.receiverName}</p>
            <p>Valor liquido: {formatCurrency(receipt.netAmount)}</p>
            <p>Status: {receipt.receiptStatus === "RECEIVED" ? "Recebido" : "Nao recebido"}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-50/75">
            {receipt.exceptionClient ? <span>Cliente excecao</span> : <span>Fluxo padrao</span>}
            {receipt.screenPhotoName ? <span>Foto tela: {receipt.screenPhotoName}</span> : null}
            {receipt.paperPhotoName ? <span>Foto papel: {receipt.paperPhotoName}</span> : null}
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-emerald-50/75">{receipt.notes}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
