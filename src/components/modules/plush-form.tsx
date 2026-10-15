"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, rotuloDeStatus } from "@/lib/status-labels";
import { useFormDraft } from "@/hooks/use-form-draft";
import { useIdempotentSubmission } from "@/hooks/use-idempotent-submission";
import {
  OFFLINE_SUBMISSION_EVENT,
  postJsonWithOfflineQueue,
  type OfflineSubmissionEventDetail,
} from "@/lib/offline-submission-queue";
import { maskCpf, maskPhone, withMask } from "@/lib/masks";
import {
  calculatePlushFinancials,
  validatePlushClientPayment,
  type PlushClientPaymentMethod,
} from "@/lib/module-calculations";
import {
  formatClosingReceiptId,
  type SavedModuleRecordResponse,
} from "@/lib/receipt";
import { isValidCpf } from "@/lib/validators";
import { getClientPrefillDataAction } from "@/server/actions/module-record-actions";
import { getContactPhonesAction } from "@/server/actions/settings-actions";
import { PhotoCaptureInput } from "./photo-capture-input";
import { SaveStatusBanner, type SaveStatus } from "./save-status-banner";
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
    payBlue: z.string().max(100).optional(),
    macAddress: z.string().max(100).optional(),
    noteNumber: z.string().optional(),
    noteiroFixed: z.string().optional(),
    coinPhotoRule: z.boolean().default(true),
    giftPhotoRule: z.boolean().default(true),
    active: z.boolean().default(true),
    collectionDate: z.string().min(1, "Informe a data da coleta."),
    grossAmount: z.coerce.number().min(0),
    cashInMachineAmount: z.coerce.number().min(0),
    commissionPercentage: z.coerce.number().min(0).max(100),
    plushCountOut: z.coerce.number().min(0),
    paymentMethod: z.enum(["PIX", "DINHEIRO", "PIX_DINHEIRO", "CARTAO", "ABERTO"]),
    clientPixAmount: z.coerce.number().min(0),
    clientCashAmount: z.coerce.number().min(0),
    discountAmount: z.coerce.number().min(0),
    discountReason: z.string().optional(),
    ownerExpenseAmount: z.coerce.number().min(0),
    compensationStatus: z.enum(["WORTH_IT", "NOT_WORTH_IT"]),
    noteiro: z.string().optional(),
    notes: z.string().optional(),
    coinPhoto: z.any().optional(),
    giftPhoto: z.any().optional(),
    pixProof: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    const coinPhoto = data.coinPhoto?.[0] as File | undefined;
    const giftPhoto = data.giftPhoto?.[0] as File | undefined;
    const pixProof = data.pixProof?.[0] as File | undefined;

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

    const { clientAmount } = calculatePlushFinancials({
      grossAmount: data.grossAmount,
      commissionPercentage: data.commissionPercentage,
      discountAmount: data.discountAmount,
      ownerExpenseAmount: data.ownerExpenseAmount,
    });
    const pixAmount = data.paymentMethod === "PIX"
      ? clientAmount
      : data.paymentMethod === "PIX_DINHEIRO"
        ? data.clientPixAmount
        : 0;
    const cashAmount = data.paymentMethod === "DINHEIRO"
      ? clientAmount
      : data.paymentMethod === "PIX_DINHEIRO"
        ? data.clientCashAmount
        : 0;
    const paymentValidation = validatePlushClientPayment({
      paymentMethod: data.paymentMethod,
      clientAmount,
      pixAmount,
      cashAmount,
      hasPixProof: Boolean(pixProof),
    });
    if (!paymentValidation.valid) {
      ctx.addIssue({
        code: "custom",
        path: [paymentValidation.field === "pixProof" ? "pixProof" : "clientCashAmount"],
        message: paymentValidation.message,
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
  receiptId?: string;
  requestKey?: string;
  closedAt?: string;
  syncPending: boolean;
  clientName: string;
  phone: string;
  code: string;
  name: string;
  machineNumber: string;
  collectionDate: string;
  grossAmount: number;
  cashInMachineAmount: number;
  clientAmount: number;
  companyAmount: number;
  netAmount: number;
  plushCountOut: number;
  paymentMethod: string;
  clientPixAmount: number;
  clientCashAmount: number;
  compensationStatus: string;
  coinPhotoName?: string;
  giftPhotoName?: string;
  pixProofName?: string;
  notes?: string;
};

function getFile(value: unknown) {
  const file = Array.isArray(value) ? value[0] : (value as FileList | undefined)?.[0];

  return file instanceof File ? file : undefined;
}

function resolveClientPaymentAmounts(
  paymentMethod: PlushClientPaymentMethod,
  clientAmount: number,
  pixAmount: number,
  cashAmount: number,
) {
  if (paymentMethod === "PIX") return { clientPixAmount: clientAmount, clientCashAmount: 0 };
  if (paymentMethod === "DINHEIRO") return { clientPixAmount: 0, clientCashAmount: clientAmount };
  if (paymentMethod === "PIX_DINHEIRO") {
    return { clientPixAmount: pixAmount, clientCashAmount: cashAmount };
  }
  return { clientPixAmount: 0, clientCashAmount: 0 };
}

function buildReceiptState({
  values,
  coinPhoto,
  giftPhoto,
  pixProof,
  receiptId,
  requestKey,
  closedAt,
  syncPending,
}: {
  values: FormValues;
  coinPhoto?: File;
  giftPhoto?: File;
  pixProof?: File;
  receiptId?: string;
  requestKey?: string;
  closedAt: string;
  syncPending: boolean;
}): ReceiptState {
  const grossAmount = Number(values.grossAmount);
  const { clientAmount, companyAmount, netAmount } = calculatePlushFinancials({
    grossAmount,
    commissionPercentage: Number(values.commissionPercentage),
    discountAmount: Number(values.discountAmount),
    ownerExpenseAmount: Number(values.ownerExpenseAmount),
  });
  const { clientPixAmount, clientCashAmount } = resolveClientPaymentAmounts(
    values.paymentMethod,
    clientAmount,
    Number(values.clientPixAmount),
    Number(values.clientCashAmount),
  );

  return {
    receiptId,
    requestKey,
    closedAt,
    syncPending,
    clientName: values.clientName,
    phone: values.phone,
    code: values.code,
    name: values.name,
    machineNumber: values.machineNumber,
    collectionDate: values.collectionDate,
    grossAmount,
    cashInMachineAmount: Number(values.cashInMachineAmount),
    clientAmount,
    companyAmount,
    netAmount,
    plushCountOut: Number(values.plushCountOut),
    paymentMethod: values.paymentMethod,
    clientPixAmount,
    clientCashAmount,
    compensationStatus: values.compensationStatus,
    coinPhotoName: coinPhoto?.name,
    giftPhotoName: giftPhoto?.name,
    pixProofName: pixProof?.name,
    notes: values.notes,
  };
}

type LoadedMachine = { clientName: string; phone: string; code: string; name: string; machineNumber: string; payBlue: string; macAddress: string; coinPhotoRule: boolean; giftPhotoRule: boolean; active: boolean };

export function PlushForm({ hideFinancials = false, initialClientName = "", initialPhone = "", initialClientId }: { hideFinancials?: boolean; initialClientName?: string; initialPhone?: string; initialClientId?: string } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const submission = useIdempotentSubmission();
  const [contactPhones, setContactPhones] = useState({ ownerPhone: "", staffPhone: "" });
  const [compensationManuallySet, setCompensationManuallySet] = useState(false);
  const [loadedMachine, setLoadedMachine] = useState<LoadedMachine | null>(null);
  const [machineLoading, setMachineLoading] = useState(Boolean(initialClientId));

  useEffect(() => {
    getContactPhonesAction().then(setContactPhones).catch(() => {});
  }, []);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: initialClientName,
      cpf: "",
      phone: initialPhone,
      coinPhotoRule: true,
      giftPhotoRule: true,
      active: true,
      paymentMethod: "PIX",
      payBlue: "",
      macAddress: "",
      compensationStatus: "NOT_WORTH_IT",
      commissionPercentage: 25,
      cashInMachineAmount: 0,
      clientPixAmount: 0,
      clientCashAmount: 0,
      discountAmount: 0,
      ownerExpenseAmount: 0,
      plushCountOut: 0,
    },
  });
  const { clearDraft } = useFormDraft(`plush:${initialClientId ?? "new"}`, form);

  useEffect(() => {
    if (!receipt?.syncPending || !receipt.requestKey) return;
    const requestKey = receipt.requestKey;
    const handleQueueChange = (event: Event) => {
      const detail = (event as CustomEvent<OfflineSubmissionEventDetail | undefined>).detail;
      if (
        detail?.type !== "synced" ||
        detail.requestKey !== requestKey ||
        detail.endpoint !== "/api/modules/maquinas-de-pelucia/records"
      ) return;
      const response = detail.data as SavedModuleRecordResponse;
      if (!response.record) return;
      setReceipt((current) => current?.requestKey === requestKey
        ? {
            ...current,
            receiptId: response.record?.id,
            closedAt: response.record?.createdAt,
            syncPending: false,
          }
        : current);
      clearDraft();
      setSaveStatus("saved");
    };
    window.addEventListener(OFFLINE_SUBMISSION_EVENT, handleQueueChange);
    return () => window.removeEventListener(OFFLINE_SUBMISSION_EVENT, handleQueueChange);
  }, [clearDraft, receipt?.requestKey, receipt?.syncPending]);

  useEffect(() => {
    if (!initialClientId) return;
    getClientPrefillDataAction("maquinas-de-pelucia", initialClientId)
      .then((data) => {
        if (!data || data.kind !== "plush-machine") return;
        setLoadedMachine({ clientName: data.clientName, phone: data.phone, code: data.code, name: data.name, machineNumber: data.machineNumber, payBlue: data.payBlue, macAddress: data.macAddress, coinPhotoRule: data.coinPhotoRule, giftPhotoRule: data.giftPhotoRule, active: data.active });
        form.setValue("clientName", data.clientName);
        form.setValue("phone", data.phone);
        form.setValue("cpf", data.cpf);
        form.setValue("code", data.code);
        form.setValue("name", data.name);
        form.setValue("machineNumber", data.machineNumber);
        form.setValue("payBlue", data.payBlue);
        form.setValue("macAddress", data.macAddress);
        form.setValue("noteNumber", data.noteNumber);
        form.setValue("noteiroFixed", data.noteiroFixed);
        form.setValue("coinPhotoRule", data.coinPhotoRule);
        form.setValue("giftPhotoRule", data.giftPhotoRule);
        form.setValue("active", data.active);
      })
      .catch(() => setSaveError("Erro ao carregar dados da máquina."))
      .finally(() => setMachineLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClientId]);

  const grossAmount = Number(useWatch({ control: form.control, name: "grossAmount" }) ?? 0);
  const commissionPercentage =
    Number(useWatch({ control: form.control, name: "commissionPercentage" }) ?? 0);
  const discountAmount = Number(useWatch({ control: form.control, name: "discountAmount" }) ?? 0);
  const ownerExpenseAmount =
    Number(useWatch({ control: form.control, name: "ownerExpenseAmount" }) ?? 0);
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" }) ?? "PIX";
  const clientPixAmount = Number(
    useWatch({ control: form.control, name: "clientPixAmount" }) ?? 0,
  );
  const clientCashAmount = Number(
    useWatch({ control: form.control, name: "clientCashAmount" }) ?? 0,
  );
  const coinPhotoRule = Boolean(
    useWatch({ control: form.control, name: "coinPhotoRule" }) ?? false,
  );
  const giftPhotoRule = Boolean(
    useWatch({ control: form.control, name: "giftPhotoRule" }) ?? false,
  );
  const { clientAmount, netAmount } = useMemo(
    () => calculatePlushFinancials({
      grossAmount,
      commissionPercentage,
      discountAmount,
      ownerExpenseAmount,
    }),
    [commissionPercentage, discountAmount, grossAmount, ownerExpenseAmount],
  );

  useEffect(() => {
    if (compensationManuallySet) return;
    form.setValue(
      "compensationStatus",
      grossAmount >= COMPENSATION_THRESHOLD ? "WORTH_IT" : "NOT_WORTH_IT",
    );
  }, [compensationManuallySet, grossAmount, form]);

  // The ref is an intentional immediate guard against two taps before React rerenders.
  // eslint-disable-next-line react-hooks/refs
  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);
    setSaveStatus("saving");

    const coinPhoto = getFile(values.coinPhoto);
    const giftPhoto = getFile(values.giftPhoto);
    const pixProof = getFile(values.pixProof);
    const calculated = calculatePlushFinancials({
      grossAmount: Number(values.grossAmount),
      commissionPercentage: Number(values.commissionPercentage),
      discountAmount: Number(values.discountAmount),
      ownerExpenseAmount: Number(values.ownerExpenseAmount),
    });
    const paymentAmounts = resolveClientPaymentAmounts(
      values.paymentMethod,
      calculated.clientAmount,
      Number(values.clientPixAmount),
      Number(values.clientCashAmount),
    );

    const localClosedAt = new Date().toISOString();
    const requestKey = submission.key();

    const payload = {
          clientName: values.clientName,
          cpf: values.cpf,
          phone: values.phone,
          code: values.code,
          name: values.name,
          machineNumber: values.machineNumber,
          payBlue: values.payBlue,
          macAddress: values.macAddress,
          noteNumber: values.noteNumber,
          noteiroFixed: values.noteiroFixed,
          collectionDate: values.collectionDate,
          grossAmount: Number(values.grossAmount),
          cashInMachineAmount: Number(values.cashInMachineAmount),
          commissionPercentage: Number(values.commissionPercentage),
          plushCountOut: Number(values.plushCountOut),
          paymentMethod: values.paymentMethod,
          clientPixAmount: paymentAmounts.clientPixAmount,
          clientCashAmount: paymentAmounts.clientCashAmount,
          discountAmount: Number(values.discountAmount),
          discountReason: values.discountReason,
          ownerExpenseAmount: Number(values.ownerExpenseAmount),
          compensationStatus: values.compensationStatus,
          noteiro: values.noteiro,
          notes: values.notes,
          coinPhotoFileId: null,
          giftPhotoFileId: null,
          pixProofFileId: null,
    };
    try {
      const result = await postJsonWithOfflineQueue<SavedModuleRecordResponse>({
        endpoint: "/api/modules/maquinas-de-pelucia/records",
        payload,
        requestKey,
        label: `Fechamento GRUA de ${values.clientName}`,
        files: [
          ...(coinPhoto ? [{ file: coinPhoto, category: "PHOTO", payloadPath: "coinPhotoFileId" }] : []),
          ...(giftPhoto ? [{ file: giftPhoto, category: "PHOTO", payloadPath: "giftPhotoFileId" }] : []),
          ...(pixProof ? [{ file: pixProof, category: "PROOF", payloadPath: "pixProofFileId" }] : []),
        ],
      });
      submission.complete();
      if (result.queued) {
        setReceipt(
          buildReceiptState({
            values,
            coinPhoto,
            giftPhoto,
            pixProof,
            requestKey,
            closedAt: localClosedAt,
            syncPending: true,
          }),
        );
        setSaveStatus("queued");
        return;
      }
      const savedRecord = result.data.record;
      if (!savedRecord) {
        throw new Error("O servidor não confirmou o fechamento da GRUA.");
      }
      clearDraft();
      setSaveStatus("saved");
      setReceipt(
        buildReceiptState({
          values,
          coinPhoto,
          giftPhoto,
          pixProof,
          receiptId: savedRecord.id,
          closedAt: savedRecord.createdAt,
          syncPending: false,
        }),
      );
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
      setSaveStatus("error");
      return;
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }

  });

  return (
    <div className="space-y-5">
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
        {machineLoading ? (
          <p className="text-sm text-slate-400">Carregando dados da máquina...</p>
        ) : loadedMachine ? (
          <div className="rounded-[18px] border border-[#8aa17c]/30 bg-[#243528]/60 p-4 text-sm text-[#dbe6d4]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-semibold text-white">{loadedMachine.clientName}</p>
                <p className="text-[#9a958b]">{loadedMachine.phone}</p>
                <p className="mt-1 break-words text-xs text-[#9a958b]">{loadedMachine.code} · {loadedMachine.name} · Máq. {loadedMachine.machineNumber}</p>
                {loadedMachine.payBlue ? <p className="break-words text-xs text-[#9a958b]">Pay Blue: {loadedMachine.payBlue}</p> : null}
                {loadedMachine.macAddress ? <p className="break-words text-xs text-[#9a958b]">Código MAC: {loadedMachine.macAddress}</p> : null}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  loadedMachine.active
                    ? "border-[#4ade80]/25 bg-[#4ade80]/10 text-[#86efac]"
                    : "border-[#f87171]/25 bg-[#f87171]/10 text-[#fca5a5]"
                }`}
              >
                {loadedMachine.active ? "Ativa" : "Inativa"}
              </span>
            </div>
            {!loadedMachine.active ? (
              <p role="alert" className="mt-3 rounded-xl border border-[#f87171]/25 bg-black/15 px-3 py-2 text-xs leading-5 text-[#fecaca]">
                Esta máquina está inativa e não pode receber um novo fechamento.
              </p>
            ) : null}
          </div>
        ) : (
          <>
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
                <label className={labelClass} htmlFor="payBlue">
                  Pay Blue
                </label>
                <input id="payBlue" maxLength={100} autoComplete="off" className={fieldClass} {...form.register("payBlue")} />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="macAddress">
                  Código MAC
                </label>
                <input
                  id="macAddress"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={100}
                  className={fieldClass}
                  placeholder="Ex.: AA:BB:CC:DD:EE:FF"
                  {...form.register("macAddress")}
                />
              </div>
            </div>
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2">
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
              Total apurado da máquina
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
            <p className={hintClass}>Valor total usado para calcular o repasse.</p>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="cashInMachineAmount">
              Dinheiro retirado da máquina
            </label>
            <input
              id="cashInMachineAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("cashInMachineAmount")}
            />
            <p className={hintClass}>
              Conferência do dinheiro físico. Não soma novamente no financeiro.
            </p>
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
              Como o cliente foi pago
            </label>
            <select id="paymentMethod" className={selectClass} {...form.register("paymentMethod")}>
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="PIX_DINHEIRO">PIX + Dinheiro</option>
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

        <section
          aria-labelledby="client-payment-title"
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4"
        >
          <div>
            <h3 id="client-payment-title" className="text-sm font-semibold text-white">
              Pagamento do cliente
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#9a958b]">
              Registre como o repasse foi entregue ao cliente.
            </p>
          </div>

          {paymentMethod === "PIX_DINHEIRO" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="clientPixAmount">
                  Parte paga em PIX (R$)
                </label>
                <input
                  id="clientPixAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className={fieldClass}
                  {...form.register("clientPixAmount")}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="clientCashAmount">
                  Parte paga em dinheiro (R$)
                </label>
                <input
                  id="clientCashAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className={fieldClass}
                  {...form.register("clientCashAmount")}
                />
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-3 text-sm text-[#c9c2b4]">
              {paymentMethod === "PIX"
                ? "O repasse inteiro será registrado em PIX."
                : paymentMethod === "DINHEIRO"
                  ? "O repasse inteiro será registrado em dinheiro."
                  : paymentMethod === "ABERTO"
                    ? "O repasse ficará em aberto."
                    : "O repasse será registrado no cartão."}
            </p>
          )}

          {form.formState.errors.clientCashAmount ? (
            <p role="alert" className="text-sm text-[#d59a8b]">
              {form.formState.errors.clientCashAmount.message}
            </p>
          ) : null}

          {paymentMethod === "PIX" || paymentMethod === "PIX_DINHEIRO" ? (
            <div className="space-y-2">
              <label className={labelClass} htmlFor="pixProof">
                Comprovante do PIX
              </label>
              <input
                id="pixProof"
                type="file"
                accept=".pdf,image/*"
                className={fieldClass}
                {...form.register("pixProof")}
              />
              <p className={hintClass}>Anexe a foto, imagem ou PDF real do pagamento.</p>
              {form.formState.errors.pixProof ? (
                <p role="alert" className="text-sm text-[#d59a8b]">
                  {form.formState.errors.pixProof.message?.toString()}
                </p>
              ) : null}
            </div>
          ) : null}

          {hideFinancials ? null : (
            <div className="grid gap-2 border-t border-white/[0.07] pt-3 text-sm sm:grid-cols-2">
              <p className="text-[#9a958b]">
                Repasse arredondado:{" "}
                <strong className="text-white">{formatCurrency(clientAmount)}</strong>
              </p>
              {paymentMethod === "PIX_DINHEIRO" ? (
                <p className="text-[#9a958b]">
                  Total informado:{" "}
                  <strong className="text-white">
                    {formatCurrency(clientPixAmount + clientCashAmount)}
                  </strong>
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="visit-settings-title">
          <div className="px-1">
            <h3 id="visit-settings-title" className="text-sm font-semibold text-white">
              Exigências desta visita
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              As regras vêm do cadastro da máquina e não podem ser alteradas durante o fechamento.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#cdb47c]">
                Fotos da visita
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <p>Foto das moedas: <strong>{coinPhotoRule ? "obrigatória" : "opcional"}</strong></p>
                <p>Foto dos brindes: <strong>{giftPhotoRule ? "obrigatória" : "opcional"}</strong></p>
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-2">
              <div className="px-3 pb-2 pt-3">
                <label className={labelClass} htmlFor="compensationStatus">
                  Vale a pena manter este ponto?
                </label>
                <select
                  id="compensationStatus"
                  aria-describedby="compensation-status-help"
                  className={`${selectClass} mt-2`}
                  {...form.register("compensationStatus", {
                    onChange: () => {
                      setCompensationManuallySet(true);
                    },
                  })}
                >
                  <option value="WORTH_IT">Compensa</option>
                  <option value="NOT_WORTH_IT">Não compensa</option>
                </select>
                <p id="compensation-status-help" className={`${hintClass} mt-2`}>
                  Sugestão automática pelo valor bruto: a partir de {formatCurrency(COMPENSATION_THRESHOLD)}, o ponto compensa. Você pode alterar.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="noteiro">
            Noteiro / observacao
          </label>
          <input id="noteiro" className={fieldClass} {...form.register("noteiro")} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <PhotoCaptureInput
              registration={form.register("coinPhoto")}
              label="Foto de moedas"
              required={coinPhotoRule}
              hint="Foto do depósito de moedas"
            />
            {form.formState.errors.coinPhoto ? (
              <p className="text-sm text-[#d59a8b]">
                {form.formState.errors.coinPhoto.message?.toString()}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <PhotoCaptureInput
              registration={form.register("giftPhoto")}
              label="Foto de brindes"
              required={giftPhotoRule}
              hint="Foto do estoque de brindes"
            />
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
          disabled={loading || loadedMachine?.active === false}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {loadedMachine?.active === false ? "Máquina inativa" : "Salvar Pelúcia"}
          <ArrowRight className="size-4" />
        </button>
      </form>

      <SaveStatusBanner status={saveStatus} />

      {receipt ? (
        <article
          className={`rounded-[28px] border p-5 ${
            receipt.syncPending
              ? "border-[#d1a04f]/30 bg-[#3a2b18]/60"
              : "border-[#8aa17c]/25 bg-[#243528]/72"
          }`}
        >
          <div className="flex items-center gap-2 text-[#dbe6d4]">
            <ReceiptText className="size-4" />
            <p className="font-medium">
              {receipt.syncPending
                ? "Fechamento da GRUA protegido neste aparelho"
                : saveError
                  ? "NAO salvo no servidor — confira a conexão"
                  : "Registro da grua salvo"}
            </p>
          </div>
          {receipt.syncPending ? (
            <div
              role="status"
              className="mt-4 rounded-2xl border border-[#d1a04f]/25 bg-black/15 p-3.5 text-sm leading-6 text-[#f3dfae]"
            >
              Aguardando sincronização automática. Os dados e as fotos já estão protegidos
              neste aparelho. A via definitiva com ID ficará disponível no sistema quando a
              internet voltar.
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Cliente: {receipt.clientName}</p>
            <p>Maquina: {receipt.name}</p>
            <p>Codigo: {receipt.code}</p>
            <p>Numero: {receipt.machineNumber}</p>
            <p>Data: {formatShortDate(receipt.collectionDate)}</p>
            <p>Dinheiro retirado: {formatCurrency(receipt.cashInMachineAmount)}</p>
            {receipt.paymentMethod === "PIX_DINHEIRO" ? (
              <>
                <p>Informado em PIX: {formatCurrency(receipt.clientPixAmount)}</p>
                <p>Informado em dinheiro: {formatCurrency(receipt.clientCashAmount)}</p>
              </>
            ) : null}
            {hideFinancials ? null : (
              <>
                <p>Bruto: {formatCurrency(receipt.grossAmount)}</p>
                <p>Repasse ao cliente: {formatCurrency(receipt.clientAmount)}</p>
                <p>Casa: {formatCurrency(receipt.netAmount)}</p>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#dbe6d4]/75">
            <span>Pelucias: {receipt.plushCountOut}</span>
            <span>Pagamento: {rotuloDeStatus(receipt.paymentMethod, PAYMENT_METHOD_LABEL)}</span>
            <span>{receipt.compensationStatus === "WORTH_IT" ? "Compensa" : "Não compensa"}</span>
            {receipt.coinPhotoName ? <span>Foto moedas: {receipt.coinPhotoName}</span> : null}
            {receipt.giftPhotoName ? <span>Foto brindes: {receipt.giftPhotoName}</span> : null}
            {receipt.pixProofName ? <span>Comprovante PIX: {receipt.pixProofName}</span> : null}
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p> : null}

          {(() => {
            const message = [
              "*Fechamento Máquinas de Pelúcia (GRUA)*",
              ...(receipt.receiptId
                ? [`Comprovante: ${formatClosingReceiptId(receipt.receiptId, receipt.collectionDate)}`]
                : []),
              `Cliente: ${receipt.clientName}`,
              `Código: ${receipt.code}`,
              `Máquina: ${receipt.name} #${receipt.machineNumber}`,
              `Data: ${formatShortDate(receipt.collectionDate)}`,
              `Pelúcias: ${receipt.plushCountOut}`,
              `Pagamento: ${rotuloDeStatus(receipt.paymentMethod, PAYMENT_METHOD_LABEL)}`,
              ...(receipt.paymentMethod === "PIX_DINHEIRO"
                ? [
                    `Informado em PIX: ${formatCurrency(receipt.clientPixAmount)}`,
                    `Informado em dinheiro: ${formatCurrency(receipt.clientCashAmount)}`,
                  ]
                : []),
              ...(!hideFinancials
                ? [
                    `Bruto: ${formatCurrency(receipt.grossAmount)}`,
                    `Repasse ao cliente: ${formatCurrency(receipt.clientAmount)}`,
                    `*Líquido: ${formatCurrency(receipt.netAmount)}*`,
                  ]
                : []),
              `Situação: ${
                receipt.syncPending
                  ? "Registro offline — aguardando sincronização"
                  : saveError
                    ? "Não salvo — confira a conexão"
                    : "Fechamento concluído"
              }`,
            ].join("\n");

            return (
              <div className="mt-3 space-y-3">
                <WhatsAppReceiptButton
                  moduleSlug="maquinas-de-pelucia"
                  receiptId={receipt.receiptId}
                  defaultPhone={receipt.phone}
                  closedAt={receipt.closedAt}
                  message={message}
                  title="1ª via — Enviar pro cliente"
                  phoneLabel="Número do cliente"
                  documentLabel="Via do cliente"
                  pdfButtonLabel="Gerar via do cliente em PDF"
                  directShareDisabled={receipt.syncPending}
                  directShareDisabledMessage="A via está protegida no aparelho. Compartilhe a imagem agora ou aguarde a sincronização para abrir o WhatsApp direto."
                />
                <WhatsAppReceiptButton
                  moduleSlug="maquinas-de-pelucia"
                  receiptId={receipt.receiptId}
                  defaultPhone={contactPhones.ownerPhone}
                  closedAt={receipt.closedAt}
                  message={message}
                  title="2ª via — Enviar pro dono"
                  phoneLabel="Número do dono"
                  documentLabel="Via do dono"
                  pdfButtonLabel="Gerar via do dono em PDF"
                  directShareDisabled={receipt.syncPending}
                  directShareDisabledMessage="A via está protegida no aparelho. Compartilhe a imagem agora ou aguarde a sincronização para abrir o WhatsApp direto."
                />
                <WhatsAppReceiptButton
                  moduleSlug="maquinas-de-pelucia"
                  receiptId={receipt.receiptId}
                  defaultPhone={contactPhones.staffPhone}
                  closedAt={receipt.closedAt}
                  message={message}
                  title="3ª via — Enviar pra equipe"
                  phoneLabel="Número da equipe/central"
                  documentLabel="Via da equipe"
                  pdfButtonLabel="Gerar via da equipe em PDF"
                  directShareDisabled={receipt.syncPending}
                  directShareDisabledMessage="A via está protegida no aparelho. Compartilhe a imagem agora ou aguarde a sincronização para abrir o WhatsApp direto."
                />
              </div>
            );
          })()}
        </article>
      ) : null}
    </div>
  );
}
