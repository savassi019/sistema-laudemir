"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText } from "lucide-react";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { fetchAddressByCep } from "@/lib/cep";
import { formatCurrency } from "@/lib/format";
import { buildMapsLink } from "@/lib/maps";
import { maskCep, maskCpf, maskPhone, withMask } from "@/lib/masks";
import { isValidCpf } from "@/lib/validators";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const schema = z
  .object({
    clientName: z.string().min(2, "Informe o cliente."),
    phone: z.string().optional(),
    cpf: z.string().optional(),
    cep: z.string().optional(),
    street: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    collectNumber: z.string().min(1, "Informe o recolhe."),
    agentName: z.string().min(2, "Informe o agente."),
    receiverName: z.string().min(2, "Informe quem recebeu."),
    occurredAt: z.string().min(1, "Informe a data e hora."),
    sentToAgentAmount: z.coerce.number().min(0),
    deliveredAmount: z.coerce.number().min(0),
    incomeAmount: z.coerce.number().min(0),
    expenseAmount: z.coerce.number().min(0),
    discountAmount: z.coerce.number().min(0),
    paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
    receiptStatus: z.enum(["RECEIVED", "NOT_RECEIVED"]),
    exceptionClient: z.boolean().default(false),
    screenPhoto: z.any().optional(),
    paperPhoto: z.any().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => !data.cpf?.trim() || isValidCpf(data.cpf), {
    message: "CPF invalido.",
    path: ["cpf"],
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
        message: "Cliente exceção precisa de pelo menos 1 foto.",
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
  paymentMethod: string;
  receiptStatus: string;
  exceptionClient: boolean;
  screenPhotoName?: string;
  paperPhotoName?: string;
  notes?: string;
};

function getFile(value: unknown) {
  const file = Array.isArray(value) ? value[0] : (value as FileList | undefined)?.[0];

  return file instanceof File ? file : undefined;
}

async function uploadFile(file: File, category: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const response = await fetch("/api/upload", { method: "POST", body: formData });
  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as { id: string };
  return result.id;
}

export function BxForm({ hideFinancials = false }: { hideFinancials?: boolean } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

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
      paymentMethod: "PIX",
    },
  });

  const incomeAmount = Number(useWatch({ control: form.control, name: "incomeAmount" }) ?? 0);
  const expenseAmount = Number(useWatch({ control: form.control, name: "expenseAmount" }) ?? 0);
  const discountAmount = Number(useWatch({ control: form.control, name: "discountAmount" }) ?? 0);
  const liveNetAmount = incomeAmount - expenseAmount - discountAmount;
  const receiptStatusWatch = String(
    useWatch({ control: form.control, name: "receiptStatus" }) ?? "NOT_RECEIVED",
  );

  const watchedStreet = useWatch({ control: form.control, name: "street" });
  const watchedNeighborhood = useWatch({ control: form.control, name: "neighborhood" });
  const watchedCity = useWatch({ control: form.control, name: "city" });
  const watchedState = useWatch({ control: form.control, name: "state" });
  const mapsLink = buildMapsLink({
    street: watchedStreet,
    neighborhood: watchedNeighborhood,
    city: watchedCity,
    state: watchedState,
  });

  async function handleCepLookup() {
    const cep = String(form.getValues("cep") ?? "");
    setCepError(null);
    setCepLoading(true);
    const address = await fetchAddressByCep(cep);
    setCepLoading(false);

    if (!address) {
      setCepError("CEP nao encontrado.");
      return;
    }

    form.setValue("street", address.street, { shouldDirty: true });
    form.setValue("neighborhood", address.neighborhood, { shouldDirty: true });
    form.setValue("city", address.city, { shouldDirty: true });
    form.setValue("state", address.state, { shouldDirty: true });
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    const screenPhoto = getFile(values.screenPhoto);
    const paperPhoto = getFile(values.paperPhoto);
    const netAmount =
      Number(values.incomeAmount) -
      Number(values.expenseAmount) -
      Number(values.discountAmount);

    const [screenPhotoFileId, paperPhotoFileId] = await Promise.all([
      screenPhoto ? uploadFile(screenPhoto, "PROOF") : Promise.resolve(null),
      paperPhoto ? uploadFile(paperPhoto, "PROOF") : Promise.resolve(null),
    ]);

    try {
      const response = await fetch("/api/modules/bx/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: values.clientName,
          phone: values.phone,
          cpf: values.cpf,
          cep: values.cep,
          street: values.street,
          neighborhood: values.neighborhood,
          city: values.city,
          state: values.state,
          collectNumber: values.collectNumber,
          agentName: values.agentName,
          receiverName: values.receiverName,
          occurredAt: values.occurredAt,
          sentToAgentAmount: Number(values.sentToAgentAmount),
          deliveredAmount: Number(values.deliveredAmount),
          incomeAmount: Number(values.incomeAmount),
          expenseAmount: Number(values.expenseAmount),
          discountAmount: Number(values.discountAmount),
          paymentMethod: values.paymentMethod,
          receiptStatus: values.receiptStatus,
          exceptionClient: values.exceptionClient,
          notes: values.notes,
          screenPhotoFileId,
          paperPhotoFileId,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar o BX.");
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

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
      paymentMethod: values.paymentMethod,
      receiptStatus: values.receiptStatus,
      exceptionClient: values.exceptionClient,
      screenPhotoName: screenPhoto?.name,
      paperPhotoName: paperPhoto?.name,
      notes: values.notes,
    });

    setLoading(false);

    submittingRef.current = false;
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-[#d1a04f]/28 bg-[#3a2b18]/72 p-4 text-sm leading-6 text-[#f3dfae]">
        <p className="font-medium">Regra do BX</p>
        <p>
          Recebido fica verde. Não recebido fica vermelho. Cliente exceção pode
          trabalhar com 1 foto apenas.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
              Cadastro de cliente
            </p>
            <label className={labelClass} htmlFor="clientName">
              Cliente
            </label>
            <input id="clientName" className={fieldClass} {...form.register("clientName")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="phone">
              Telefone
            </label>
            <input
              id="phone"
              className={fieldClass}
              inputMode="tel"
              maxLength={15}
              {...withMask(form.register("phone"), maskPhone)}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="cpf">
              CPF
            </label>
            <input
              id="cpf"
              className={fieldClass}
              inputMode="numeric"
              maxLength={14}
              {...withMask(form.register("cpf"), maskCpf)}
            />
            {form.formState.errors.cpf ? (
              <p className="text-sm text-[#d59a8b]">{form.formState.errors.cpf.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="cep">
              CEP
            </label>
            <div className="flex gap-2">
              <input
                id="cep"
                className={fieldClass}
                inputMode="numeric"
                placeholder="00000-000"
                maxLength={9}
                {...withMask(form.register("cep"), maskCep)}
                onBlur={handleCepLookup}
              />
              <button
                type="button"
                onClick={handleCepLookup}
                disabled={cepLoading}
                className="shrink-0 rounded-xl border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-3 text-xs font-semibold text-[#f3dfae] disabled:opacity-60"
              >
                {cepLoading ? "..." : "Buscar"}
              </button>
            </div>
            {cepError ? <p className="text-sm text-[#d59a8b]">{cepError}</p> : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="street">
              Rua
            </label>
            <input id="street" className={fieldClass} {...form.register("street")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="neighborhood">
              Bairro
            </label>
            <input id="neighborhood" className={fieldClass} {...form.register("neighborhood")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="city">
              Cidade
            </label>
            <input id="city" className={fieldClass} {...form.register("city")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="state">
              Estado
            </label>
            <input id="state" className={fieldClass} maxLength={2} {...form.register("state")} />
          </div>
          {mapsLink ? (
            <div className="md:col-span-2">
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8aa17c] underline-offset-2 hover:underline"
              >
                Ver no mapa
              </a>
            </div>
          ) : null}
          <div className="space-y-2">
            <label className={labelClass} htmlFor="collectNumber">
              Recolhe 1
            </label>
            <input
              id="collectNumber"
              className={fieldClass}
              {...form.register("collectNumber")}
            />
            <p className={hintClass}>Número do recolhe para controle da operação.</p>
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
              Situação do recebimento
            </label>
            <select
              id="receiptStatus"
              className={[
                selectClass,
                receiptStatusWatch === "RECEIVED"
                  ? "border-[#6b9d6f]/45 bg-[#6b9d6f]/10 text-[#bfe3c2]"
                  : "border-[#b46c5d]/45 bg-[#b46c5d]/10 text-[#f0c3b9]",
              ].join(" ")}
              {...form.register("receiptStatus")}
            >
              <option value="RECEIVED">Recebido</option>
              <option value="NOT_RECEIVED">Não recebido</option>
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
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("sentToAgentAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="deliveredAmount">
              Valor entregue ao cliente
            </label>
            <input
              id="deliveredAmount"
              type="number"
              inputMode="decimal"
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
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("incomeAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="expenseAmount">
              Saídas
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
          <div className="space-y-2">
            <label className={labelClass} htmlFor="discountAmount">
              Desconto
            </label>
            <input
              id="discountAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("discountAmount")}
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

        {hideFinancials ? null : (
          <div
            className={[
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              liveNetAmount < 0
                ? "border-[#b46c5d]/40 bg-[#b46c5d]/10 text-[#f0a08f]"
                : "border-[#6b9d6f]/35 bg-[#6b9d6f]/10 text-[#bfe3c2]",
            ].join(" ")}
          >
            Saldo líquido: {formatCurrency(liveNetAmount)}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="screenPhoto">
              Foto da tela
            </label>
            <input
              id="screenPhoto"
              type="file"
              accept="image/*"
              capture="environment"
              className={fieldClass}
              {...form.register("screenPhoto")}
            />
            {form.formState.errors.screenPhoto ? (
              <p className="text-sm text-[#d59a8b]">
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
              accept="image/*"
              capture="environment"
              className={fieldClass}
              {...form.register("paperPhoto")}
            />
            {form.formState.errors.paperPhoto ? (
              <p className="text-sm text-[#d59a8b]">
                {form.formState.errors.paperPhoto.message?.toString()}
              </p>
            ) : null}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
          <input type="checkbox" {...form.register("exceptionClient")} />
          Cliente exceção
        </label>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="notes">
            Observações
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar BX
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
            <p className="font-medium">Registro BX pronto</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Cliente: {receipt.clientName}</p>
            <p>Recolhe: {receipt.collectNumber}</p>
            <p>Agente: {receipt.agentName}</p>
            <p>Recebeu: {receipt.receiverName}</p>
            {hideFinancials ? null : (
              <p className={receipt.netAmount < 0 ? "font-semibold text-[#f0a08f]" : "font-semibold text-[#bfe3c2]"}>
                Valor liquido: {formatCurrency(receipt.netAmount)}
              </p>
            )}
            <p className={receipt.receiptStatus === "RECEIVED" ? "font-semibold text-[#bfe3c2]" : "font-semibold text-[#f0a08f]"}>
              Status: {receipt.receiptStatus === "RECEIVED" ? "Recebido" : "Não recebido"}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#dbe6d4]/75">
            {receipt.exceptionClient ? <span>Cliente exceção</span> : <span>Fluxo padrão</span>}
            <span>Pagamento: {receipt.paymentMethod}</span>
            {receipt.screenPhotoName ? <span>Foto tela: {receipt.screenPhotoName}</span> : null}
            {receipt.paperPhotoName ? <span>Foto papel: {receipt.paperPhotoName}</span> : null}
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p> : null}
          <WhatsAppReceiptButton
            message={[
              "*Comprovante BX*",
              `Cliente: ${receipt.clientName}`,
              `Recolhe: ${receipt.collectNumber}`,
              `Agente: ${receipt.agentName}`,
              `Entradas: ${formatCurrency(receipt.incomeAmount)}`,
              `Saídas: ${formatCurrency(receipt.expenseAmount)}`,
              `Desconto: ${formatCurrency(receipt.discountAmount)}`,
              `*Líquido: ${formatCurrency(receipt.netAmount)}*`,
              `Pagamento: ${receipt.paymentMethod}`,
              `Status: ${receipt.receiptStatus === "RECEIVED" ? "Recebido" : "Não recebido"}`,
            ].join("\n")}
          />
        </article>
      ) : null}
    </div>
  );
}
