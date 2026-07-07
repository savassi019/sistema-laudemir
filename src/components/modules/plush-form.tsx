"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { maskCpf, maskPhone, withMask } from "@/lib/masks";
import { isValidCpf } from "@/lib/validators";
import { getContactPhonesAction } from "@/server/actions/settings-actions";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const COMPENSATION_THRESHOLD = 1000;

const schema = z
  .object({
    clientName: z.string().min(2, "Informe o cliente."),
    cpf: z.string().optional(),
    phone: z.string().min(8, "Informe um telefone valido."),
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
    compensationStatus: z.enum(["WORTH_IT", "NOT_WORTH_IT"]),
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

    if (data.discountAmount > 0 && !data.discountReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["discountReason"],
        message: "Explique o motivo do desconto.",
      });
    }

    if (data.cpf?.trim() && !isValidCpf(data.cpf)) {
      ctx.addIssue({
        code: "custom",
        path: ["cpf"],
        message: "CPF invalido.",
      });
    }
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  clientName: string;
  phone: string;
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
  compensationStatus: string;
  coinPhotoName?: string;
  giftPhotoName?: string;
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

export function PlushForm({ hideFinancials = false }: { hideFinancials?: boolean } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [contactPhones, setContactPhones] = useState({ ownerPhone: "", staffPhone: "" });
  const compensationManuallySet = useRef(false);

  useEffect(() => {
    getContactPhonesAction()
      .then(setContactPhones)
      .catch(() => {});
  }, []);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: "",
      cpf: "",
      phone: "",
      coinPhotoRule: true,
      giftPhotoRule: true,
      active: true,
      paymentMethod: "PIX",
      compensationStatus: "NOT_WORTH_IT",
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

  useEffect(() => {
    if (compensationManuallySet.current) return;
    form.setValue(
      "compensationStatus",
      grossAmount >= COMPENSATION_THRESHOLD ? "WORTH_IT" : "NOT_WORTH_IT",
    );
  }, [grossAmount, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    const coinPhoto = getFile(values.coinPhoto);
    const giftPhoto = getFile(values.giftPhoto);

    const [coinPhotoFileId, giftPhotoFileId] = await Promise.all([
      coinPhoto ? uploadFile(coinPhoto, "PHOTO") : Promise.resolve(null),
      giftPhoto ? uploadFile(giftPhoto, "PHOTO") : Promise.resolve(null),
    ]);

    try {
      const response = await fetch("/api/modules/maquinas-de-pelucia/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: values.clientName,
          cpf: values.cpf,
          phone: values.phone,
          code: values.code,
          name: values.name,
          machineNumber: values.machineNumber,
          noteNumber: values.noteNumber,
          noteiroFixed: values.noteiroFixed,
          coinPhotoRule: values.coinPhotoRule,
          giftPhotoRule: values.giftPhotoRule,
          active: values.active,
          collectionDate: values.collectionDate,
          grossAmount: Number(values.grossAmount),
          commissionPercentage: Number(values.commissionPercentage),
          plushCountOut: Number(values.plushCountOut),
          paymentMethod: values.paymentMethod,
          discountAmount: Number(values.discountAmount),
          discountReason: values.discountReason,
          ownerExpenseAmount: Number(values.ownerExpenseAmount),
          compensationStatus: values.compensationStatus,
          noteiro: values.noteiro,
          notes: values.notes,
          coinPhotoFileId,
          giftPhotoFileId,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar a Pelucia.");
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

    setReceipt({
      clientName: values.clientName,
      phone: values.phone,
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
      compensationStatus: values.compensationStatus,
      coinPhotoName: coinPhoto?.name,
      giftPhotoName: giftPhoto?.name,
      notes: values.notes,
    });

    setLoading(false);

    submittingRef.current = false;
  });

  const photoRuleText = [
    coinPhotoRule ? "foto de moedas obrigatória" : "foto de moedas opcional",
    giftPhotoRule ? "foto de brindes obrigatória" : "foto de brindes opcional",
  ].join(" | ");

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-[#8aa17c]/25 bg-[#243528]/72 p-4 text-sm leading-6 text-[#dbe6d4]">
        <p className="font-medium">Regras da grua</p>
        <p>{photoRuleText}</p>
      </div>

      {hideFinancials ? null : (
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
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
          Cadastro de cliente
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="clientName">
              Nome
            </label>
            <input id="clientName" className={fieldClass} {...form.register("clientName")} />
            {form.formState.errors.clientName ? (
              <p className="text-sm text-[#d59a8b]">{form.formState.errors.clientName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="phone">
              Telefone
            </label>
            <input
              id="phone"
              inputMode="tel"
              maxLength={15}
              className={fieldClass}
              {...withMask(form.register("phone"), maskPhone)}
            />
            {form.formState.errors.phone ? (
              <p className="text-sm text-[#d59a8b]">{form.formState.errors.phone.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="cpf">
              CPF
            </label>
            <input
              id="cpf"
              inputMode="numeric"
              maxLength={14}
              className={fieldClass}
              {...withMask(form.register("cpf"), maskCpf)}
            />
            {form.formState.errors.cpf ? (
              <p className="text-sm text-[#d59a8b]">{form.formState.errors.cpf.message}</p>
            ) : null}
          </div>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
          Máquina
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="code">
              Código
            </label>
            <input id="code" className={fieldClass} {...form.register("code")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="name">
              Nome da máquina
            </label>
            <input id="name" className={fieldClass} {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="machineNumber">
              Número da máquina
            </label>
            <input id="machineNumber" className={fieldClass} {...form.register("machineNumber")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="noteNumber">
              Número do noteiro
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
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("grossAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="commissionPercentage">
              Comissão %
            </label>
            <input
              id="commissionPercentage"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              className={fieldClass}
              {...form.register("commissionPercentage")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="plushCountOut">
              Quantidade de pelúcia
            </label>
            <input
              id="plushCountOut"
              type="number"
              inputMode="numeric"
              min="0"
              className={fieldClass}
              {...form.register("plushCountOut")}
            />
            <p className={hintClass}>Use para acompanhar saída e reposição.</p>
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
            <label className={labelClass} htmlFor="discountReason">
              Motivo do desconto
            </label>
            <input
              id="discountReason"
              className={fieldClass}
              placeholder="Obrigatório se houver desconto"
              {...form.register("discountReason")}
            />
            {form.formState.errors.discountReason ? (
              <p className="text-sm text-[#d59a8b]">
                {form.formState.errors.discountReason.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="ownerExpenseAmount">
              Despesa do dono
            </label>
            <input
              id="ownerExpenseAmount"
              type="number"
              inputMode="decimal"
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
            Foto de moedas obrigatória
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("giftPhotoRule")} />
            Foto de brindes obrigatória
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("active")} />
            Máquina ativa
          </label>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="compensationStatus">
              Cliente compensa?
            </label>
            <select
              id="compensationStatus"
              className={selectClass}
              {...form.register("compensationStatus", {
                onChange: () => {
                  compensationManuallySet.current = true;
                },
              })}
            >
              <option value="NOT_WORTH_IT">Não compensa</option>
              <option value="WORTH_IT">Compensa</option>
            </select>
            <p className={hintClass}>
              Sugerido automaticamente pelo bruto (≥ {formatCurrency(COMPENSATION_THRESHOLD)} = compensa) — pode trocar manualmente.
            </p>
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
              Foto de moedas
            </label>
            <input id="coinPhoto" type="file" accept="image/*" capture="environment" className={fieldClass} {...form.register("coinPhoto")} />
            {form.formState.errors.coinPhoto ? (
              <p className="text-sm text-[#d59a8b]">
                {form.formState.errors.coinPhoto.message?.toString()}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="giftPhoto">
              Foto de brindes
            </label>
            <input id="giftPhoto" type="file" accept="image/*" capture="environment" className={fieldClass} {...form.register("giftPhoto")} />
            {form.formState.errors.giftPhoto ? (
              <p className="text-sm text-[#d59a8b]">
                {form.formState.errors.giftPhoto.message?.toString()}
              </p>
            ) : null}
          </div>
        </div>

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
          Salvar Pelúcia
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
            <p className="font-medium">Registro da grua salvo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Cliente: {receipt.clientName}</p>
            <p>Maquina: {receipt.name}</p>
            <p>Codigo: {receipt.code}</p>
            <p>Numero: {receipt.machineNumber}</p>
            <p>Data: {formatShortDate(receipt.collectionDate)}</p>
            {hideFinancials ? null : (
              <>
                <p>Bruto: {formatCurrency(receipt.grossAmount)}</p>
                <p>Casa: {formatCurrency(receipt.netAmount)}</p>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#dbe6d4]/75">
            <span>Pelucias: {receipt.plushCountOut}</span>
            <span>Pagamento: {receipt.paymentMethod}</span>
            <span>{receipt.compensationStatus === "WORTH_IT" ? "Compensa" : "Não compensa"}</span>
            {receipt.coinPhotoName ? <span>Foto moedas: {receipt.coinPhotoName}</span> : null}
            {receipt.giftPhotoName ? <span>Foto brindes: {receipt.giftPhotoName}</span> : null}
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p> : null}

          {(() => {
            const message = [
              "*Comprovante Pelúcia*",
              `Cliente: ${receipt.clientName}`,
              `Código: ${receipt.code}`,
              `Máquina: ${receipt.name} #${receipt.machineNumber}`,
              `Data: ${formatShortDate(receipt.collectionDate)}`,
              `Pelúcias: ${receipt.plushCountOut}`,
              `Bruto: ${formatCurrency(receipt.grossAmount)}`,
              `*Líquido: ${formatCurrency(receipt.netAmount)}*`,
              `Pagamento: ${receipt.paymentMethod}`,
            ].join("\n");

            return (
              <div className="mt-3 space-y-3">
                <WhatsAppReceiptButton
                  defaultPhone={receipt.phone}
                  message={message}
                  title="1ª via — Enviar pro cliente"
                  phoneLabel="Número do cliente"
                />
                <WhatsAppReceiptButton
                  defaultPhone={contactPhones.ownerPhone}
                  message={message}
                  title="2ª via — Enviar pro dono"
                  phoneLabel="Número do dono"
                />
                <WhatsAppReceiptButton
                  defaultPhone={contactPhones.staffPhone}
                  message={message}
                  title="3ª via — Enviar pra equipe"
                  phoneLabel="Número da equipe/central"
                />
              </div>
            );
          })()}
        </article>
      ) : null}
    </div>
  );
}
