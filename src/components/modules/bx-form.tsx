"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { fetchAddressByCep } from "@/lib/cep";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, RECEIPT_STATUS_LABEL, rotuloDeStatus } from "@/lib/status-labels";
import { useFormDraft } from "@/hooks/use-form-draft";
import { useIdempotentSubmission } from "@/hooks/use-idempotent-submission";
import { postJsonWithOfflineQueue } from "@/lib/offline-submission-queue";
import { buildMapsLink } from "@/lib/maps";
import { maskCep, maskCpf, maskPhone, withMask } from "@/lib/masks";
import {
  formatClosingReceiptId,
  type SavedModuleRecordResponse,
} from "@/lib/receipt";
import { isValidCpf } from "@/lib/validators";
import { getClientPrefillDataAction } from "@/server/actions/module-record-actions";
import { getCurrentUserNameAction } from "@/server/actions/user-actions";
import { PhotoCaptureInput } from "./photo-capture-input";
import { SaveStatusBanner, type SaveStatus } from "./save-status-banner";
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
    occurredAt: z.string().min(1, "Informe a data e hora."),
    sentToAgentAmount: z.coerce.number().min(0),
    deliveredAmount: z.coerce.number().min(0),
    incomeAmount: z.coerce.number().min(0),
    expenseAmount: z.coerce.number().min(0),
    discountAmount: z.coerce.number().min(0),
    generatedDebtAmount: z.coerce.number().min(0),
    paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
    receiptStatus: z.enum(["RECEIVED", "NOT_RECEIVED", "DELIVERED", "PRIZE"]),
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

    if (
      (data.receiptStatus === "DELIVERED" || data.receiptStatus === "PRIZE") &&
      Number(data.deliveredAmount) <= 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveredAmount"],
        message: "Informe o valor do prêmio.",
      });
    }

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
  receiptId?: string;
  closedAt?: string;
  clientName: string;
  phone?: string;
  operatorName: string;
  occurredAt: string;
  sentToAgentAmount: number;
  deliveredAmount: number;
  incomeAmount: number;
  expenseAmount: number;
  discountAmount: number;
  clientDebt: number;
  generatedDebtAmount: number;
  remainingDebt: number;
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

type LoadedBxClient = { clientName: string; phone: string; debt: number };

/**
 * Recebido/Nao recebido sao opostos (verde/vermelho). "Premio"
 * e o valor liberado pela maquina: uma unica operacao, destacada em dourado,
 * que nao gera divida para o cliente.
 */
const RECEIPT_STATUS_COLOR: Record<string, string> = {
  RECEIVED: "border-[#6b9d6f]/45 bg-[#6b9d6f]/10 text-[#bfe3c2]",
  NOT_RECEIVED: "border-[#b46c5d]/45 bg-[#b46c5d]/10 text-[#f0c3b9]",
  DELIVERED: "border-[#d1a04f]/45 bg-[#d1a04f]/10 text-[#f3dfae]",
  PRIZE: "border-[#d1a04f]/45 bg-[#d1a04f]/10 text-[#f3dfae]",
};

const RECEIPT_STATUS_TEXT_COLOR: Record<string, string> = {
  RECEIVED: "text-[#bfe3c2]",
  NOT_RECEIVED: "text-[#f0a08f]",
  DELIVERED: "text-[#f3dfae]",
  PRIZE: "text-[#f3dfae]",
};

export function BxForm({
  hideFinancials = false,
  initialClientName = "",
  initialPhone = "",
  initialClientId,
  startAtRegistration = false,
}: {
  hideFinancials?: boolean;
  initialClientName?: string;
  initialPhone?: string;
  initialClientId?: string;
  startAtRegistration?: boolean;
} = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const submission = useIdempotentSubmission();
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [loadedClient, setLoadedClient] = useState<LoadedBxClient | null>(null);
  const [clientLoading, setClientLoading] = useState(Boolean(initialClientId));
  // Quem esta fazendo a operacao vem do login, nao de um numero digitado
  // (era pra isso que "Recolhe" servia antes).
  const [operatorName, setOperatorName] = useState("");
  const [flowStep, setFlowStep] = useState<"registration" | "operation">(
    startAtRegistration || !initialClientId ? "registration" : "operation",
  );

  useEffect(() => {
    getCurrentUserNameAction()
      .then(setOperatorName)
      .catch(() => setOperatorName(""));
  }, []);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: initialClientName,
      phone: initialPhone,
      receiptStatus: "NOT_RECEIVED",
      exceptionClient: false,
      sentToAgentAmount: 0,
      deliveredAmount: 0,
      incomeAmount: 0,
      expenseAmount: 0,
      discountAmount: 0,
      generatedDebtAmount: 0,
      paymentMethod: "PIX",
    },
  });
  const { clearDraft } = useFormDraft(`bx:${initialClientId ?? "new"}`, form);

  useEffect(() => {
    if (!initialClientId) return;
    getClientPrefillDataAction("bx", initialClientId)
      .then((data) => {
        if (!data || data.kind !== "bx-transaction") {
          setFlowStep("registration");
          return;
        }
        setLoadedClient({ clientName: data.clientName, phone: data.phone, debt: data.debt });
        form.setValue("clientName", data.clientName);
        form.setValue("phone", data.phone);
        // Desconto puxa a divida do cliente automatico -- fica editavel pra
        // dar pra pagar so uma parte, o resto continua pra proxima operacao.
        form.setValue("discountAmount", data.debt);
        // CPF invalido gravado antes da validacao existir travava o
        // fechamento: o campo nao aparece nesta tela, entao o erro nao tinha
        // onde ser exibido e o botao Salvar simplesmente nao respondia.
        // O cadastro do cliente mantem o CPF; aqui ele so nao entra.
        form.setValue("cpf", data.cpf && isValidCpf(data.cpf) ? data.cpf : "");
        form.setValue("cep", data.cep);
        form.setValue("street", data.street);
        form.setValue("neighborhood", data.neighborhood);
        form.setValue("city", data.city);
        form.setValue("state", data.state);
        form.setValue("exceptionClient", data.exceptionClient);
      })
      .catch(() => {
        setSaveError("Erro ao carregar dados do cliente.");
        setFlowStep("registration");
      })
      .finally(() => setClientLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClientId]);

  const receiptStatusWatch = String(
    useWatch({ control: form.control, name: "receiptStatus" }) ?? "NOT_RECEIVED",
  );

  useEffect(() => {
    // PRIZE era uma opcao separada. Agora e a mesma operacao que DELIVERED;
    // normaliza rascunhos antigos sem perder os demais dados preenchidos.
    if (receiptStatusWatch === "PRIZE") {
      form.setValue("receiptStatus", "DELIVERED", { shouldDirty: true });
    }

    // Somente "Nao recebido" pode criar divida nova.
    if (
      receiptStatusWatch !== "NOT_RECEIVED" &&
      Number(form.getValues("generatedDebtAmount") ?? 0) !== 0
    ) {
      form.setValue("generatedDebtAmount", 0, { shouldDirty: true });
    }
  }, [form, receiptStatusWatch]);

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

  function continueToOperation() {
    const clientName = String(form.getValues("clientName") ?? "").trim();
    const cpf = String(form.getValues("cpf") ?? "").trim();
    let valid = true;

    form.clearErrors(["clientName", "cpf"]);

    if (clientName.length < 2) {
      form.setError("clientName", { message: "Informe o cliente." });
      valid = false;
    }

    if (cpf && !isValidCpf(cpf)) {
      form.setError("cpf", { message: "CPF inválido." });
      valid = false;
    }

    if (!valid) return;

    form.setValue("clientName", clientName, { shouldDirty: true });
    setLoadedClient({
      clientName,
      phone: String(form.getValues("phone") ?? ""),
      debt: loadedClient?.debt ?? 0,
    });
    setSaveError(null);
    setFlowStep("operation");
  }

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

  async function submitValues(values: FormValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);
    setSaveStatus("saving");

    const screenPhoto = getFile(values.screenPhoto);
    const paperPhoto = getFile(values.paperPhoto);
    const receiptStatus = values.receiptStatus === "PRIZE" ? "DELIVERED" : values.receiptStatus;
    const prizeExpenseAmount =
      receiptStatus === "DELIVERED" ? Number(values.deliveredAmount) : 0;
    const netAmount =
      Number(values.incomeAmount) -
      Number(values.expenseAmount) -
      prizeExpenseAmount -
      Number(values.discountAmount);
    const clientDebt = loadedClient?.debt ?? 0;
    const generatedDebtAmount =
      receiptStatus === "NOT_RECEIVED" ? Number(values.generatedDebtAmount) : 0;
    const remainingDebt =
      Math.max(clientDebt - Number(values.discountAmount), 0) +
      generatedDebtAmount;

    const [screenPhotoFileId, paperPhotoFileId] = navigator.onLine
      ? await Promise.all([
          screenPhoto ? uploadFile(screenPhoto, "PROOF") : Promise.resolve(null),
          paperPhoto ? uploadFile(paperPhoto, "PROOF") : Promise.resolve(null),
        ])
      : [null, null];
    let savedRecord: SavedModuleRecordResponse["record"];

    const payload = {
          clientName: values.clientName,
          phone: values.phone,
          cpf: values.cpf,
          cep: values.cep,
          street: values.street,
          neighborhood: values.neighborhood,
          city: values.city,
          state: values.state,
          occurredAt: values.occurredAt,
          sentToAgentAmount: Number(values.sentToAgentAmount),
          deliveredAmount: Number(values.deliveredAmount),
          incomeAmount: Number(values.incomeAmount),
          expenseAmount: Number(values.expenseAmount),
          discountAmount: Number(values.discountAmount),
          customerDebt: clientDebt,
          generatedDebtAmount,
          paymentMethod: values.paymentMethod,
          receiptStatus,
          exceptionClient: values.exceptionClient,
          notes: values.notes,
          screenPhotoFileId,
          paperPhotoFileId,
    };
    try {
      const result = await postJsonWithOfflineQueue<SavedModuleRecordResponse>({
        endpoint: "/api/modules/bx/records",
        payload,
        requestKey: submission.key(),
        label: `Operacao BX de ${values.clientName}`,
        files: navigator.onLine
          ? undefined
          : [
              ...(screenPhoto ? [{ file: screenPhoto, category: "PROOF", payloadPath: "screenPhotoFileId" }] : []),
              ...(paperPhoto ? [{ file: paperPhoto, category: "PROOF", payloadPath: "paperPhotoFileId" }] : []),
            ],
      });
      submission.complete();
      if (result.queued) {
        setSaveStatus("queued");
        return;
      }
      savedRecord = result.data.record;
      clearDraft();
      setSaveStatus("saved");
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
      setSaveStatus("error");
      return;
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }

    setReceipt({
      receiptId: savedRecord?.id,
      closedAt: savedRecord?.createdAt,
      clientName: values.clientName,
      phone: values.phone,
      operatorName,
      occurredAt: values.occurredAt,
      sentToAgentAmount: Number(values.sentToAgentAmount),
      deliveredAmount: Number(values.deliveredAmount),
      incomeAmount: Number(values.incomeAmount),
      expenseAmount: Number(values.expenseAmount),
      discountAmount: Number(values.discountAmount),
      clientDebt,
      generatedDebtAmount,
      remainingDebt,
      netAmount,
      paymentMethod: values.paymentMethod,
      receiptStatus,
      exceptionClient: values.exceptionClient,
      screenPhotoName: screenPhoto?.name,
      paperPhotoName: paperPhoto?.name,
      notes: values.notes,
    });

  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void form.handleSubmit(submitValues)(event);
  }

  if (clientLoading) {
    return (
      <div className="flex min-h-28 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-4 text-sm text-[#9a958b]">
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        Carregando dados do cliente...
      </div>
    );
  }

  if (flowStep === "registration" || !loadedClient) {
    return (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-[#6f8fb4]/30 bg-[#172331]/72 p-4 text-sm leading-6 text-[#bcd4ed]">
          <p className="font-medium">Cadastro do cliente</p>
          <p>Preencha os dados abaixo. A operação só abre depois de você continuar.</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            continueToOperation();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
                Dados do cliente
              </p>
              <label className={labelClass} htmlFor="clientName">
                Cliente
              </label>
              <input id="clientName" className={fieldClass} {...form.register("clientName")} />
              {form.formState.errors.clientName ? (
                <p className="text-sm text-[#d59a8b]">
                  {form.formState.errors.clientName.message}
                </p>
              ) : null}
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
                  className="min-h-11 shrink-0 rounded-xl border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-3 text-xs font-semibold text-[#f3dfae] disabled:opacity-60"
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
              <input
                id="neighborhood"
                className={fieldClass}
                {...form.register("neighborhood")}
              />
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
                  className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[#8aa17c] underline-offset-2 active:underline"
                >
                  Ver no mapa
                </a>
              </div>
            ) : null}
          </div>

          <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("exceptionClient")} />
            Cliente exceção
          </label>

          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition active:scale-[0.99]"
          >
            Continuar para operação
            <ArrowRight className="size-4" />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-[#d1a04f]/28 bg-[#3a2b18]/72 p-4 text-sm leading-6 text-[#f3dfae]">
        <p className="font-medium">Regra do BX</p>
        <p>
          Recebido fica verde. Não recebido fica vermelho. Prêmio fica dourado
          e não gera dívida para o cliente.
          Cliente exceção pode trabalhar com 1 foto apenas.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Primeira coisa do formulario: a foto da tela se registra antes de
            qualquer outro dado, nao no fim. Foto do papel continua la
            embaixo, perto de "Cliente excecao" -- pedido do usuario apos
            reuniao de alinhamento (so a da tela sobe, a do papel fica). */}
        <div className="space-y-1">
          <PhotoCaptureInput
            registration={form.register("screenPhoto")}
            label="Foto da tela"
            hint="Tela do terminal BX"
          />
          {form.formState.errors.screenPhoto ? (
            <p className="text-sm text-[#d59a8b]">
              {form.formState.errors.screenPhoto.message?.toString()}
            </p>
          ) : null}
        </div>

        {clientLoading ? (
          <p className="text-sm text-slate-400">Carregando dados do cliente...</p>
        ) : loadedClient ? (
          <div className="rounded-[18px] border border-[#6b9d6f]/30 bg-[#1a2e1e]/60 p-4 text-sm text-[#bfe3c2] space-y-0.5">
            <p className="font-semibold text-white">{loadedClient.clientName}</p>
            <p className="text-[#9a958b]">{loadedClient.phone}</p>
            <p className={loadedClient.debt > 0 ? "text-[#f0c3b9]" : "text-[#9a958b]"}>
              Dívida: {formatCurrency(loadedClient.debt)}
            </p>
            {!initialClientId ? (
              <button
                type="button"
                onClick={() => setFlowStep("registration")}
                className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-[#bfe3c2] underline underline-offset-2 active:text-white"
              >
                Editar cadastro
              </button>
            ) : null}
          </div>
        ) : (
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
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className={labelClass}>Funcionário</p>
            <div className={`${fieldClass} flex items-center text-slate-300`}>
              {operatorName || "Carregando..."}
            </div>
            <p className={hintClass}>
              O funcionário responsável pelo fechamento é identificado
              automaticamente pelo login.
            </p>
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
              className={[selectClass, RECEIPT_STATUS_COLOR[receiptStatusWatch]].join(" ")}
              {...form.register("receiptStatus")}
            >
              <option value="RECEIVED">Recebido</option>
              <option value="NOT_RECEIVED">Não recebido</option>
              <option value="DELIVERED">Prêmio</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="sentToAgentAmount">
              Valor entregue ao funcionário
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
              {receiptStatusWatch === "DELIVERED"
                ? "Valor do prêmio"
                : "Valor entregue ao cliente"}
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
            {form.formState.errors.deliveredAmount ? (
              <p className="text-sm text-[#d59a8b]">
                {form.formState.errors.deliveredAmount.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="expenseAmount">
              {receiptStatusWatch === "DELIVERED"
                ? "Outras despesas e gastos (sem o prêmio)"
                : "Despesas e gastos"}
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
            <p className={hintClass}>
              Puxa a dívida do cliente sozinho. Pode pagar só uma parte: o que
              sobrar continua pra próxima operação dele.
            </p>
          </div>
          {receiptStatusWatch === "NOT_RECEIVED" ? (
            <div className="space-y-2">
              <label className={labelClass} htmlFor="generatedDebtAmount">
                Ficou devendo
              </label>
              <input
                id="generatedDebtAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register("generatedDebtAmount")}
              />
              <p className={hintClass}>
                Quanto o cliente fica devendo a partir desta operação.
              </p>
            </div>
          ) : null}
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

        <div className="space-y-1">
          <PhotoCaptureInput
            registration={form.register("paperPhoto")}
            label="Foto do papel"
            hint="Comprovante impresso"
          />
          {form.formState.errors.paperPhoto ? (
            <p className="text-sm text-[#d59a8b]">
              {form.formState.errors.paperPhoto.message?.toString()}
            </p>
          ) : null}
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

        {/* Sem isto, um campo invalido que nao esta visivel na tela faz o
            botao Salvar nao responder, sem explicacao nenhuma. */}
        {Object.keys(form.formState.errors).length > 0 ? (
          <div className="rounded-2xl border border-[#b46c5d]/35 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]">
            <p className="font-medium">Falta corrigir para salvar:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px]">
              {Object.entries(form.formState.errors).map(([campo, erro]) => (
                <li key={campo}>{(erro as { message?: string })?.message ?? campo}</li>
              ))}
            </ul>
          </div>
        ) : null}

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

      <SaveStatusBanner status={saveStatus} />

      {receipt ? (
        <article className="rounded-[28px] border border-[#8aa17c]/25 bg-[#243528]/72 p-5">
          <div className="flex items-center gap-2 text-[#dbe6d4]">
            <ReceiptText className="size-4" />
            <p className="font-medium">{saveError ? "NAO salvo no servidor — confira a conexão" : "Registro BX pronto"}</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Cliente: {receipt.clientName}</p>
            <p>Funcionário: {receipt.operatorName}</p>
            {receipt.receiptStatus === "DELIVERED" ? (
              <p className="font-semibold text-[#f3dfae]">
                Prêmio: {formatCurrency(receipt.deliveredAmount)}
              </p>
            ) : null}
            {hideFinancials ? null : (
              <p className="font-semibold text-[#dbe6d4]">
                Despesas e gastos: {formatCurrency(receipt.expenseAmount)}
              </p>
            )}
            {hideFinancials || (receipt.clientDebt <= 0 && receipt.remainingDebt <= 0) ? null : (
              <p className="font-semibold text-[#dbe6d4]">
                Dívida restante do cliente: {formatCurrency(receipt.remainingDebt)}
              </p>
            )}
            <p className={`font-semibold ${RECEIPT_STATUS_TEXT_COLOR[receipt.receiptStatus] ?? ""}`}>
              Status: {rotuloDeStatus(receipt.receiptStatus, RECEIPT_STATUS_LABEL)}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#dbe6d4]/75">
            {receipt.exceptionClient ? <span>Cliente exceção</span> : <span>Fluxo padrão</span>}
            <span>Pagamento: {rotuloDeStatus(receipt.paymentMethod, PAYMENT_METHOD_LABEL)}</span>
            {receipt.screenPhotoName ? <span>Foto tela: {receipt.screenPhotoName}</span> : null}
            {receipt.paperPhotoName ? <span>Foto papel: {receipt.paperPhotoName}</span> : null}
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p> : null}
          <WhatsAppReceiptButton
            defaultPhone={receipt.phone ?? ""}
            autoOpen={!saveError && !!receipt.phone}
            closedAt={receipt.closedAt}
            title="Via do cliente — WhatsApp e PDF"
            documentLabel="Via do cliente"
            pdfButtonLabel="Gerar via do cliente em PDF"
            message={[
              "*Fechamento BX*",
              ...(receipt.receiptId
                ? [`Comprovante: ${formatClosingReceiptId(receipt.receiptId, receipt.occurredAt)}`]
                : []),
              `Cliente: ${receipt.clientName}`,
              `Atendido por: ${receipt.operatorName}`,
              `Data: ${new Date(receipt.occurredAt).toLocaleDateString("pt-BR")}`,
              `Pagamento: ${rotuloDeStatus(receipt.paymentMethod, PAYMENT_METHOD_LABEL)}`,
              ...(!hideFinancials
                ? [
                    ...(receipt.receiptStatus === "DELIVERED"
                      ? [`Prêmio da máquina: ${formatCurrency(receipt.deliveredAmount)}`]
                      : []),
                    `Despesas e gastos: ${formatCurrency(receipt.expenseAmount)}`,
                    `Desconto: ${formatCurrency(receipt.discountAmount)}`,
                    `*Resultado da operação: ${formatCurrency(receipt.netAmount)}*`,
                  ]
                : []),
              `Situação: ${saveError ? "Não salvo — confira a conexão" : "Fechamento concluído"}`,
              `Status: ${rotuloDeStatus(receipt.receiptStatus, RECEIPT_STATUS_LABEL)}`,
            ].join("\n")}
          />
        </article>
      ) : null}
    </div>
  );
}
