"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Plus,
  ReceiptText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { fetchAddressByCep } from "@/lib/cep";
import { formatCurrency, formatMachineCounter } from "@/lib/format";
import { buildMapsLink } from "@/lib/maps";
import { maskCep, maskCpf, maskPhone, withMask } from "@/lib/masks";
import { postJsonWithOfflineQueue } from "@/lib/offline-submission-queue";
import { formatClosingReceiptId } from "@/lib/receipt";
import { calculateSlotCustomerDebt } from "@/lib/slot-finance";
import { isValidCpf } from "@/lib/validators";
import {
  getClientPrefillDataAction,
  getSlotClientMachinesAction,
  registerSlotClientAction,
} from "@/server/actions/module-record-actions";
import { PhotoCaptureInput } from "./photo-capture-input";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  ABERTO: "Aberto",
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
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error ?? "Nao foi possivel enviar a foto.");
  }
  const result = (await response.json()) as { id: string };
  return result.id;
}

function todayStr() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function isReceiptTestClient(clientName: string) {
  return clientName.trim().toLocaleLowerCase("pt-BR") === "bar do chico";
}

// ──────────────────────────────────────────────────────────────────────────
// Cadastro: aqui e onde se decide QUANTAS maquinas o cliente tem. O
// fechamento de cada uma acontece depois, na visita (SlotVisitForm) --
// registrar so cria as maquinas vazias, numeradas 1..N.
// ──────────────────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    clientName: z.string().min(1, "Informe o cliente."),
    phone: z.string().optional(),
    cpf: z.string().optional(),
    cep: z.string().optional(),
    street: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    machineCount: z.coerce.number().int().min(1, "Informe quantas máquinas."),
  })
  .refine((data) => !data.cpf?.trim() || isValidCpf(data.cpf), {
    message: "CPF invalido.",
    path: ["cpf"],
  });

type RegisterInput = z.input<typeof registerSchema>;
type RegisterValues = z.output<typeof registerSchema>;

function SlotRegisterForm({
  initialClientName,
  initialPhone,
  addingToClientName,
  onRegistered,
}: {
  initialClientName?: string;
  initialPhone?: string;
  addingToClientName?: string;
  onRegistered: (clientName: string) => void;
}) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      clientName: addingToClientName ?? initialClientName ?? "",
      phone: initialPhone ?? "",
      machineCount: 1,
    },
  });

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
    setSaving(true);
    setSaveError(null);
    try {
      const result = await registerSlotClientAction({
        clientName: values.clientName,
        phone: values.phone,
        cpf: values.cpf,
        cep: values.cep,
        street: values.street,
        neighborhood: values.neighborhood,
        city: values.city,
        state: values.state,
        machineCount: Number(values.machineCount),
        allowExisting: Boolean(addingToClientName),
      });
      onRegistered(result.clientName);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível cadastrar. Confira os campos e tente novamente.");
      setSaving(false);
    }
  });

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
              {addingToClientName ? "Adicionar máquinas" : "Cadastro de cliente / ponto"}
            </p>
            <label className={labelClass} htmlFor="clientName">
              Nome do cliente
            </label>
            <input
              id="clientName"
              className={fieldClass}
              disabled={Boolean(addingToClientName)}
              {...form.register("clientName")}
            />
            {form.formState.errors.clientName ? (
              <p className="text-[12px] text-[#d59a8b]">{form.formState.errors.clientName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="machineCount">
              Quantidade de máquinas
            </label>
            <input
              id="machineCount"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              className={fieldClass}
              {...form.register("machineCount")}
            />
            {form.formState.errors.machineCount ? (
              <p className="text-[12px] text-[#d59a8b]">{form.formState.errors.machineCount.message}</p>
            ) : (
              <p className={hintClass}>
                {addingToClientName
                  ? "Quantas máquinas a mais para este cliente."
                  : "Numeradas sozinhas, de 1 até essa quantidade."}
              </p>
            )}
          </div>

          {!addingToClientName ? (
            <>
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
                  <p className="text-[12px] text-[#d59a8b]">{form.formState.errors.cpf.message}</p>
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
                    className="shrink-0 rounded-xl border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-3 text-xs font-semibold text-[#f3dfae] transition active:scale-95 active:bg-[#d1a04f]/20 disabled:opacity-60"
                  >
                    {cepLoading ? "..." : "Buscar"}
                  </button>
                </div>
                {cepError ? <p className="text-[12px] text-[#d59a8b]">{cepError}</p> : null}
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
                    className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[#8aa17c] underline-offset-2 transition hover:underline active:text-[#a3bb96]"
                  >
                    Ver no mapa
                  </a>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {saveError ? <p className="text-sm text-[#d59a8b]">{saveError}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] active:scale-[0.99] active:bg-[#daa855] disabled:opacity-70"
        >
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          {addingToClientName ? "Adicionar máquinas" : "Cadastrar e ir para a visita"}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Visita: fecha varias maquinas do mesmo cliente de uma vez, tudo na mesma
// tela (pedido do dono do projeto) -- cada maquina e uma secao que abre e
// fecha, com o "anterior" ja vindo do ultimo fechamento dela.
// ──────────────────────────────────────────────────────────────────────────

const visitMachineSchema = z
  .object({
    machineId: z.string(),
    clientMachineNumber: z.number(),
    included: z.boolean(),
    currentIncome: z.coerce.number().min(0),
    previousIncome: z.coerce.number().min(0),
    currentExpense: z.coerce.number().min(0),
    previousExpense: z.coerce.number().min(0),
    percentageSplit: z.coerce.number().min(0).max(100),
    optionalGreedAmount: z.coerce.number().min(0),
    previousMachineDebt: z.coerce.number().min(0),
    finalMachineDebt: z.coerce.number().min(0),
    screenPhoto: z.any().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.included) return;
    if (data.currentIncome < data.previousIncome) {
      ctx.addIssue({
        code: "custom",
        path: ["currentIncome"],
        message: "A entrada atual nao pode ser menor que a anterior.",
      });
    }
    if (data.currentExpense < data.previousExpense) {
      ctx.addIssue({
        code: "custom",
        path: ["currentExpense"],
        message: "A saida atual nao pode ser menor que a anterior.",
      });
    }
    const photo = (data.screenPhoto as FileList | undefined)?.[0];
    if (!photo) {
      ctx.addIssue({ code: "custom", path: ["screenPhoto"], message: "Tire uma foto da tela antes de salvar." });
    }
  });
type VisitMachineValues = z.output<typeof visitMachineSchema>;

const visitSchema = z
  .object({
    occurredAt: z.string().min(1, "Informe a data."),
    paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
    previousCustomerDebt: z.coerce.number().min(0),
    customerDebtDiscounted: z.coerce.number().min(0),
    machines: z.array(visitMachineSchema).min(1),
  });

type VisitInput = z.input<typeof visitSchema>;
type VisitValues = z.output<typeof visitSchema>;
type ReviewedVisitValues = VisitValues & { generatedDebtAmount: number };

function computeMachineSplit(m: {
  currentIncome: number;
  previousIncome: number;
  currentExpense: number;
  previousExpense: number;
  percentageSplit: number;
  optionalGreedAmount: number;
  previousMachineDebt: number;
  finalMachineDebt: number;
}) {
  const incomeDifference = m.currentIncome - m.previousIncome;
  const expenseDifference = m.currentExpense - m.previousExpense;
  const netRevenue = incomeDifference - expenseDifference;
  const machineDebtChange = m.finalMachineDebt - m.previousMachineDebt;
  // O negativo da maquina e um saldo acumulado. Somente a variacao entre o
  // saldo anterior e o atual pertence a este fechamento.
  const adjustedTotal = netRevenue - machineDebtChange;
  const clientShareBase = adjustedTotal * (m.percentageSplit / 100);
  const houseShareBase = adjustedTotal - clientShareBase;
  const clientShareAfterGreed = clientShareBase - m.optionalGreedAmount;
  const houseShareAfterGreed = houseShareBase + m.optionalGreedAmount;
  return {
    incomeDifference,
    expenseDifference,
    netRevenue,
    machineDebtChange,
    clientShareFinal: clientShareAfterGreed,
    houseAmount: houseShareAfterGreed,
  };
}

function calculateClientTotalBeforeDebt(machines: VisitMachineValues[]) {
  return Math.round(
    machines
      .filter((machine) => machine.included)
      .reduce((sum, machine) => sum + computeMachineSplit(machine).clientShareFinal, 0) * 100,
  ) / 100;
}

function calculateAutomaticCustomerDebt(
  machines: VisitMachineValues[],
  previousCustomerDebt: number,
) {
  return calculateSlotCustomerDebt({
    clientShareBeforeDebt: calculateClientTotalBeforeDebt(machines),
    previousCustomerDebt,
  });
}

type MachineResult = {
  recordId: string;
  closedAt: string;
  clientMachineNumber: number;
  clientShareFinal?: number;
  houseAmount?: number;
  previousMachineDebt?: number;
  finalMachineDebt?: number;
  previousCustomerDebt?: number;
  finalCustomerDebt?: number;
};

function MachineFieldset({
  index,
  form,
  expanded,
  onToggle,
  watchedMachine,
  hideFinancials,
}: {
  index: number;
  form: UseFormReturn<VisitInput, unknown, VisitValues>;
  expanded: boolean;
  onToggle: () => void;
  watchedMachine: VisitInput["machines"] extends (infer M)[] ? M | undefined : never;
  hideFinancials: boolean;
}) {
  const included = watchedMachine?.included ?? true;
  const clientMachineNumber = watchedMachine?.clientMachineNumber ?? index + 1;

  const split = computeMachineSplit({
    currentIncome: Number(watchedMachine?.currentIncome ?? 0),
    previousIncome: Number(watchedMachine?.previousIncome ?? 0),
    currentExpense: Number(watchedMachine?.currentExpense ?? 0),
    previousExpense: Number(watchedMachine?.previousExpense ?? 0),
    percentageSplit: Number(watchedMachine?.percentageSplit ?? 50),
    optionalGreedAmount: Number(watchedMachine?.optionalGreedAmount ?? 0),
    previousMachineDebt: Number(watchedMachine?.previousMachineDebt ?? 0),
    finalMachineDebt: Number(watchedMachine?.finalMachineDebt ?? 0),
  });

  const machineErrors = form.formState.errors.machines?.[index];

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        included ? "border-[rgba(245,241,232,0.08)]" : "border-[rgba(245,241,232,0.05)] opacity-60"
      } bg-[#0b0f0e]/35`}
    >
      <div className="flex items-center gap-3 pl-4 pr-1">
        <label className="flex min-h-11 flex-1 items-center gap-2.5 py-3 text-sm font-semibold text-white active:opacity-70">
          <input type="checkbox" className="size-5 shrink-0 accent-[#d1a04f]" {...form.register(`machines.${index}.included`)} />
          Máquina {clientMachineNumber}
        </label>
        {!hideFinancials && included ? (
          <span
            className={`shrink-0 text-xs font-medium ${
              split.houseAmount < 0 ? "text-[#f87171]" : "text-[#8cc490]"
            }`}
          >
            {formatCurrency(split.houseAmount)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="flex size-11 shrink-0 items-center justify-center text-[#9a958b] transition hover:text-white active:scale-95"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {/* Sempre montado, so escondido via CSS quando fechado/excluido -- se
          desmontasse (renderizacao condicional), o PhotoCaptureInput perdia
          o preview e o input de arquivo perdia a foto ja tirada ao trocar
          de maquina. Reportado pelo usuario: "a foto da anterior sempre
          some". */}
      <div
        className={
          expanded && included
            ? "space-y-4 border-t border-[rgba(245,241,232,0.08)] px-4 py-4"
            : "hidden"
        }
      >
          <div className="space-y-1">
            <PhotoCaptureInput
              registration={form.register(`machines.${index}.screenPhoto`)}
              label="Foto da tela da máquina"
              hint="Obrigatório para salvar o fechamento"
            />
            {machineErrors?.screenPhoto ? (
              <p className="text-sm text-[#d59a8b]">{machineErrors.screenPhoto.message?.toString()}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClass}>Entrada atual</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.currentIncome`)}
              />
              {machineErrors?.currentIncome ? (
                <p className="text-xs text-[#d59a8b]">{machineErrors.currentIncome.message?.toString()}</p>
              ) : (
                <p className={hintClass}>
                  Leitura: {formatMachineCounter(Number(watchedMachine?.currentIncome ?? 0))}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <input type="hidden" {...form.register(`machines.${index}.previousIncome`)} />
              <label className={labelClass}>Entrada anterior</label>
              <div className="flex min-h-12 items-center rounded-2xl border border-[rgba(245,241,232,0.1)] bg-white/[0.025] px-4 py-3 text-base font-semibold text-white">
                {formatMachineCounter(Number(watchedMachine?.previousIncome ?? 0))}
              </div>
              <p className={hintClass}>Puxa sozinho da última conferência.</p>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Saída atual</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.currentExpense`)}
              />
              {machineErrors?.currentExpense ? (
                <p className="text-xs text-[#d59a8b]">{machineErrors.currentExpense.message?.toString()}</p>
              ) : (
                <p className={hintClass}>
                  Leitura: {formatMachineCounter(Number(watchedMachine?.currentExpense ?? 0))}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <input type="hidden" {...form.register(`machines.${index}.previousExpense`)} />
              <label className={labelClass}>Saída anterior</label>
              <div className="flex min-h-12 items-center rounded-2xl border border-[rgba(245,241,232,0.1)] bg-white/[0.025] px-4 py-3 text-base font-semibold text-white">
                {formatMachineCounter(Number(watchedMachine?.previousExpense ?? 0))}
              </div>
              <p className={hintClass}>Puxa sozinho da última conferência.</p>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>% do cliente</label>
              <input
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                max="100"
                className={fieldClass}
                {...form.register(`machines.${index}.percentageSplit`)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Ganância</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.optionalGreedAmount`)}
              />
            </div>
            <div className="space-y-1.5">
              <input type="hidden" {...form.register(`machines.${index}.previousMachineDebt`)} />
              <label className={labelClass}>Negativo da máquina</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.finalMachineDebt`)}
              />
              <p className={hintClass}>
                Já vem com o último valor; altere somente se o negativo mostrado na máquina mudou.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Observações</label>
            <textarea className={textareaClass} {...form.register(`machines.${index}.notes`)} />
          </div>

          {!hideFinancials ? (
            <div className="rounded-xl border border-[#6f8790]/25 bg-[#27383a]/70 p-3 text-xs leading-5 text-[#d6e1de]/80">
              Saldo {formatMachineCounter(split.netRevenue)} · Variação do negativo da máquina{" "}
              {formatCurrency(split.machineDebtChange)} · Cliente {formatCurrency(split.clientShareFinal)} · Infinity{" "}
              {formatCurrency(split.houseAmount)}
            </div>
          ) : null}
      </div>
    </div>
  );
}

function SlotVisitForm({
  hideFinancials,
  clientName,
  onAddMoreMachines,
}: {
  hideFinancials: boolean;
  clientName: string;
  onAddMoreMachines: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [reviewValues, setReviewValues] = useState<ReviewedVisitValues | null>(null);
  const [results, setResults] = useState<MachineResult[] | null>(null);
  const [isReceiptPreview, setIsReceiptPreview] = useState(false);
  const [queuedReceipt, setQueuedReceipt] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<{
    paymentMethod: string;
    occurredAt: string;
    closedAt: string;
    receiptSourceId: string | null;
  } | null>(null);
  const savingRef = useRef(false);
  const visitKeyRef = useRef<string | null>(null);
  const uploadedPhotosRef = useRef(new Map<string, { file: File; id: string }>());

  const form = useForm<VisitInput, unknown, VisitValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      occurredAt: todayStr(),
      paymentMethod: "PIX",
      previousCustomerDebt: 0,
      customerDebtDiscounted: 0,
      machines: [],
    },
  });
  const { fields, replace } = useFieldArray({ control: form.control, name: "machines" });

  useEffect(() => {
    let cancelled = false;
    getSlotClientMachinesAction(clientName)
      .then((data) => {
        if (cancelled) return;
        setPhone(data.phone);
        form.setValue("previousCustomerDebt", data.customerDebt);
        form.setValue("customerDebtDiscounted", 0);
        const fillReceiptTest = isReceiptTestClient(clientName);
        replace(
          data.machines.map((m) => ({
            machineId: m.id,
            clientMachineNumber: m.clientMachineNumber,
            included: m.active,
            currentIncome: fillReceiptTest
              ? m.previousIncome + 500 + m.clientMachineNumber * 100
              : 0,
            previousIncome: m.previousIncome,
            currentExpense: fillReceiptTest
              ? m.previousExpense + 100 + m.clientMachineNumber * 20
              : 0,
            previousExpense: m.previousExpense,
            percentageSplit: m.percentageSplit,
            optionalGreedAmount: m.optionalGreedAmount,
            previousMachineDebt: m.machineDebt,
            finalMachineDebt: m.machineDebt,
            notes: fillReceiptTest ? "Prévia de comprovante — não salvar" : "",
          })),
        );
        setExpandedIndex(0);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Erro ao carregar as máquinas deste cliente.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName, reloadVersion]);

  const watchedMachines = useWatch({ control: form.control, name: "machines" }) ?? [];
  const watchedPreviousCustomerDebt = Number(
    useWatch({ control: form.control, name: "previousCustomerDebt" }) ?? 0,
  );
  const automaticCustomerDebt = calculateAutomaticCustomerDebt(
    watchedMachines as VisitMachineValues[],
    watchedPreviousCustomerDebt,
  );

  const onSubmit = form.handleSubmit((values) => {
    setSaveError(null);
    const included = values.machines.filter((m) => m.included);
    if (included.length === 0) {
      setSaveError("Selecione ao menos uma máquina pra fechar.");
      return;
    }
    const customerDebt = calculateAutomaticCustomerDebt(
      values.machines,
      values.previousCustomerDebt,
    );
    setReviewValues({
      ...values,
      customerDebtDiscounted: customerDebt.customerDebtDiscounted,
      generatedDebtAmount: customerDebt.generatedDebtAmount,
    });
  });

  function openReceiptPreview() {
    const values = form.getValues() as VisitValues;
    const included = values.machines.filter((machine) => machine.included);
    if (included.length === 0) {
      setSaveError("Selecione ao menos uma máquina para testar o comprovante.");
      return;
    }
    const customerDebt = calculateAutomaticCustomerDebt(
      values.machines,
      values.previousCustomerDebt,
    );
    const previewResults = included.map((machine, index) => {
      const split = computeMachineSplit(machine);
      const carriesCustomerDebt = index === 0;
      return {
        recordId: `PREVIA-${machine.clientMachineNumber}`,
        closedAt: new Date().toISOString(),
        clientMachineNumber: machine.clientMachineNumber,
        clientShareFinal:
          split.clientShareFinal -
          (carriesCustomerDebt ? customerDebt.customerDebtDiscounted : 0),
        houseAmount:
          split.houseAmount +
          (carriesCustomerDebt
            ? customerDebt.customerDebtDiscounted - customerDebt.generatedDebtAmount
            : 0),
        previousMachineDebt: machine.previousMachineDebt,
        finalMachineDebt: machine.finalMachineDebt,
        previousCustomerDebt: values.previousCustomerDebt,
        finalCustomerDebt: customerDebt.finalCustomerDebt,
      };
    });

    setSaveError(null);
    setLastSubmission({
      paymentMethod: values.paymentMethod,
      occurredAt: values.occurredAt,
      closedAt: previewResults[0]?.closedAt ?? new Date().toISOString(),
      receiptSourceId: null,
    });
    setIsReceiptPreview(true);
    setResults(previewResults);
  }

  async function confirmSave() {
    if (!reviewValues || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const included = reviewValues.machines.filter((machine) => machine.included);
    try {
      visitKeyRef.current ??= globalThis.crypto.randomUUID();
      if (!navigator.onLine) {
        const files: Array<{ file: File; payloadPath: string; category: string }> = [];
        const queuedMachines = included.map((machine, index) => {
          const screenPhoto = getFile(machine.screenPhoto);
          if (!screenPhoto) throw new Error(`Falta a foto da maquina ${machine.clientMachineNumber}.`);
          files.push({ file: screenPhoto, payloadPath: `machines.${index}.screenPhotoFileId`, category: "PHOTO" });
          return {
            machineId: machine.machineId,
            previousIncome: Number(machine.previousIncome),
            currentIncome: Number(machine.currentIncome),
            previousExpense: Number(machine.previousExpense),
            currentExpense: Number(machine.currentExpense),
            percentageSplit: Number(machine.percentageSplit),
            optionalGreedAmount: Number(machine.optionalGreedAmount),
            previousMachineDebt: Number(machine.previousMachineDebt),
            finalMachineDebt: Number(machine.finalMachineDebt),
            screenPhotoFileId: null,
            notes: machine.notes,
          };
        });
        const requestKey = visitKeyRef.current;
        const queued = await postJsonWithOfflineQueue<never>({
          endpoint: "/api/modules/h-caca-niquel/visits",
          requestKey,
          label: `Visita H de ${clientName}`,
          files,
          payload: {
            visitKey: requestKey,
            clientName,
            occurredAt: reviewValues.occurredAt,
            paymentMethod: reviewValues.paymentMethod,
            previousCustomerDebt: Number(reviewValues.previousCustomerDebt),
            customerDebtDiscounted: Number(reviewValues.customerDebtDiscounted),
            machines: queuedMachines,
          },
        });
        if (queued.queued) {
          openReceiptPreview();
          setQueuedReceipt(true);
          setLastSubmission({
            paymentMethod: reviewValues.paymentMethod,
            occurredAt: reviewValues.occurredAt,
            closedAt: new Date().toISOString(),
            receiptSourceId: requestKey,
          });
          setReviewValues(null);
          visitKeyRef.current = null;
          return;
        }
      }

      const uploadedMachines = await Promise.all(
        included.map(async (machine) => {
          const screenPhoto = getFile(machine.screenPhoto);
          if (!screenPhoto) throw new Error(`Falta a foto da máquina ${machine.clientMachineNumber}.`);
          const cached = uploadedPhotosRef.current.get(machine.machineId);
          let screenPhotoFileId = cached?.file === screenPhoto ? cached.id : null;
          if (!screenPhotoFileId) {
            screenPhotoFileId = await uploadFile(screenPhoto, "PHOTO");
            uploadedPhotosRef.current.set(machine.machineId, { file: screenPhoto, id: screenPhotoFileId });
          }
          return {
            machineId: machine.machineId,
            previousIncome: Number(machine.previousIncome),
            currentIncome: Number(machine.currentIncome),
            previousExpense: Number(machine.previousExpense),
            currentExpense: Number(machine.currentExpense),
            percentageSplit: Number(machine.percentageSplit),
            optionalGreedAmount: Number(machine.optionalGreedAmount),
            previousMachineDebt: Number(machine.previousMachineDebt),
            finalMachineDebt: Number(machine.finalMachineDebt),
            screenPhotoFileId,
            notes: machine.notes,
          };
        }),
      );

      const response = await fetch("/api/modules/h-caca-niquel/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitKey: visitKeyRef.current,
          clientName,
          occurredAt: reviewValues.occurredAt,
          paymentMethod: reviewValues.paymentMethod,
          previousCustomerDebt: Number(reviewValues.previousCustomerDebt),
          customerDebtDiscounted: Number(reviewValues.customerDebtDiscounted),
          machines: uploadedMachines,
        }),
      });
      const responseBody = (await response.json().catch(() => null)) as
        | { error?: string; visitKey?: string; results?: MachineResult[] }
        | null;
      if (!response.ok || !responseBody?.results) {
        throw new Error(responseBody?.error ?? "Não foi possível salvar a visita.");
      }

      setResults(responseBody.results);
      setIsReceiptPreview(false);
      setQueuedReceipt(false);
      setLastSubmission({
        paymentMethod: reviewValues.paymentMethod,
        occurredAt: reviewValues.occurredAt,
        closedAt: responseBody.results[0]?.closedAt ?? new Date().toISOString(),
        receiptSourceId: responseBody.visitKey ?? visitKeyRef.current,
      });
      setReviewValues(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar a visita.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Carregando máquinas de {clientName}...</p>;
  }
  if (loadError) {
    return <p className="text-sm text-[#d59a8b]">{loadError}</p>;
  }

  if (results) {
    const totalCliente = results.reduce((s, r) => s + (r.clientShareFinal ?? 0), 0);
    const totalCasa = results.reduce((s, r) => s + (r.houseAmount ?? 0), 0);
    const savedFinalCustomerDebt = results[0]?.finalCustomerDebt ?? 0;
    return (
      <div className="space-y-4">
        <article
          className={`rounded-[28px] border p-5 ${
            isReceiptPreview || queuedReceipt
              ? "border-[#d1a04f]/30 bg-[#3a2b18]/60"
              : "border-[#8aa17c]/25 bg-[#243528]/72"
          }`}
        >
          <div className="flex items-center gap-2 text-[#dbe6d4]">
            <ReceiptText className="size-4" />
            <p className="font-medium">
              {queuedReceipt
                ? `Visita de ${clientName} protegida neste aparelho`
                : isReceiptPreview
                  ? `Prévia da via de ${clientName} — nada foi salvo`
                  : `Visita de ${clientName} salva`}
            </p>
          </div>
          <div className="mt-4 space-y-1.5 text-sm text-[#dbe6d4]/85">
            {results.map((r) => (
              <div key={r.clientMachineNumber} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-[#8aa17c]" />
                  Máquina {r.clientMachineNumber}
                </span>
                {hideFinancials ? null : <span>{formatCurrency(r.houseAmount ?? 0)}</span>}
              </div>
            ))}
          </div>
          {hideFinancials ? null : (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#8aa17c]/20 pt-3 text-sm">
              <p>
                Total cliente: <span className="font-semibold text-white">{formatCurrency(totalCliente)}</span>
              </p>
              <p>
                Total Infinity: <span className="font-semibold text-white">{formatCurrency(totalCasa)}</span>
              </p>
              <p className="col-span-2">
                Saldo final da dívida: {" "}
                <span className="font-semibold text-white">
                  {formatCurrency(savedFinalCustomerDebt)}
                </span>
              </p>
            </div>
          )}
          {queuedReceipt ? (
            <p className="mt-3 text-sm text-[#f3dfae]">
              O comprovante definitivo ficara disponivel depois da sincronizacao automatica.
            </p>
          ) : null}
          {saveError ? <p className="mt-3 text-sm text-[#f0c9ad]">{saveError}</p> : null}
          {!queuedReceipt ? <div className="mt-5 border-t border-[#8aa17c]/20 pt-4">
            <WhatsAppReceiptButton
              defaultPhone={phone}
              autoOpen={!!phone}
              closedAt={lastSubmission?.closedAt}
              title="Via do cliente — WhatsApp e PDF"
              documentLabel="Via do cliente"
              pdfButtonLabel="Gerar via do cliente em PDF"
              message={[
                "*Fechamento H*",
                isReceiptPreview
                  ? ""
                  : `Comprovante: ${formatClosingReceiptId(lastSubmission?.receiptSourceId ?? "", lastSubmission?.occurredAt ?? todayStr())}`,
                `Cliente: ${clientName}`,
                lastSubmission
                  ? `Data: ${new Date(`${lastSubmission.occurredAt}T12:00:00`).toLocaleDateString("pt-BR")}`
                  : "",
                `Máquinas fechadas: ${results.map((result) => result.clientMachineNumber).join(", ")}`,
                ...(hideFinancials
                  ? []
                  : [
                      `*Repasse ao cliente: ${formatCurrency(totalCliente)}*`,
                      `*Saldo final da dívida: ${formatCurrency(savedFinalCustomerDebt)}*`,
                    ]),
                lastSubmission
                  ? `Pagamento: ${PAYMENT_METHOD_LABEL[lastSubmission.paymentMethod] ?? lastSubmission.paymentMethod}`
                  : "",
                `Situação: ${isReceiptPreview ? "Prévia para conferência" : "Fechamento concluído"}`,
              ]
                .filter(Boolean)
                .join("\n")}
            />
          </div> : null}
        </article>
        <button
          type="button"
          onClick={() => {
            if (isReceiptPreview && !queuedReceipt) {
              setResults(null);
              setLastSubmission(null);
              setIsReceiptPreview(false);
              return;
            }
            setLoading(true);
            setLoadError(null);
            setResults(null);
            setReviewValues(null);
            setLastSubmission(null);
            setIsReceiptPreview(false);
            setQueuedReceipt(false);
            setSaveError(null);
            visitKeyRef.current = null;
            uploadedPhotosRef.current.clear();
            setReloadVersion((current) => current + 1);
          }}
          className="inline-flex min-h-11 items-center text-xs font-semibold text-[#9a958b] underline underline-offset-2 transition hover:text-white active:text-white"
        >
          {isReceiptPreview && !queuedReceipt ? "Voltar ao teste" : "Fazer outra visita"}
        </button>
      </div>
    );
  }

  if (reviewValues) {
    const reviewMachines = reviewValues.machines.filter((machine) => machine.included);
    const reviewed = reviewMachines.map((machine) => ({
      machine,
      split: computeMachineSplit(machine),
    }));
    const totalClient =
      reviewed.reduce((sum, item) => sum + item.split.clientShareFinal, 0) -
      reviewValues.customerDebtDiscounted;
    const totalInfinity =
      reviewed.reduce((sum, item) => sum + item.split.houseAmount, 0) +
      reviewValues.customerDebtDiscounted -
      reviewValues.generatedDebtAmount;
    const reviewedFinalCustomerDebt = Math.max(
      reviewValues.previousCustomerDebt +
        reviewValues.generatedDebtAmount -
        reviewValues.customerDebtDiscounted,
      0,
    );

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#d1a04f]/30 bg-[#3a2b18]/55 p-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="size-4 text-[#f3dfae]" />
            <p className="text-sm font-semibold text-white">Revisar antes de salvar</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#c9c2b4]">
            Confira os números. A visita inteira será salva de uma vez; nada foi registrado ainda.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <p className="text-[#9a958b]">Data</p>
              <p className="mt-1 font-semibold text-white">
                {new Date(`${reviewValues.occurredAt}T12:00:00`).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <p className="text-[#9a958b]">Pagamento</p>
              <p className="mt-1 font-semibold text-white">
                {PAYMENT_METHOD_LABEL[reviewValues.paymentMethod] ?? reviewValues.paymentMethod}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {reviewed.map(({ machine, split }) => (
            <article
              key={machine.machineId}
              className="rounded-2xl border border-white/10 bg-[#0b0f0e]/55 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Máquina {machine.clientMachineNumber}</p>
                <span className="text-xs text-[#8aa17c]">Foto pronta</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <p className="text-[#7e786d]">Entrada anterior → atual</p>
                  <p className="mt-0.5 text-[#c9c2b4]">
                    {formatMachineCounter(machine.previousIncome)} → {formatMachineCounter(machine.currentIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-[#7e786d]">Saída anterior → atual</p>
                  <p className="mt-0.5 text-[#c9c2b4]">
                    {formatMachineCounter(machine.previousExpense)} → {formatMachineCounter(machine.currentExpense)}
                  </p>
                </div>
                <div>
                  <p className="text-[#7e786d]">Negativo da máquina</p>
                  <p className="mt-0.5 text-[#c9c2b4]">
                    {formatCurrency(machine.finalMachineDebt)}
                  </p>
                </div>
              </div>
              {!hideFinancials ? (
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-xs">
                  <div>
                    <p className="text-[#7e786d]">Saldo</p>
                    <p className="mt-0.5 font-semibold text-white">{formatMachineCounter(split.netRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-[#7e786d]">Cliente</p>
                    <p className="mt-0.5 font-semibold text-white">{formatCurrency(split.clientShareFinal)}</p>
                  </div>
                  <div>
                    <p className="text-[#7e786d]">Infinity</p>
                    <p className="mt-0.5 font-semibold text-white">{formatCurrency(split.houseAmount)}</p>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <div className="rounded-2xl border border-[#d1a04f]/25 bg-[#2a2318]/55 p-4">
          <p className="text-sm font-semibold text-white">Dívida do cliente neste fechamento</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {!hideFinancials ? (
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <p className="text-[#9a958b]">Dívida anterior</p>
                <p className="mt-1 font-semibold text-white">
                  {formatCurrency(reviewValues.previousCustomerDebt)}
                </p>
              </div>
            ) : null}
            {!hideFinancials ? (
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <p className="text-[#9a958b]">Gerada automaticamente</p>
                <p className="mt-1 font-semibold text-white">
                  {formatCurrency(reviewValues.generatedDebtAmount)}
                </p>
              </div>
            ) : null}
            {!hideFinancials ? (
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <p className="text-[#9a958b]">Descontada automaticamente</p>
                <p className="mt-1 font-semibold text-white">
                  {formatCurrency(reviewValues.customerDebtDiscounted)}
                </p>
              </div>
            ) : null}
            {!hideFinancials ? (
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <p className="text-[#9a958b]">Saldo final</p>
                <p className="mt-1 font-semibold text-white">
                  {formatCurrency(reviewedFinalCustomerDebt)}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {!hideFinancials ? (
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#6f8790]/25 bg-[#172123]/70 p-4 text-sm">
            <div>
              <p className="text-xs text-[#9a958b]">Total do cliente</p>
              <p className="mt-1 font-semibold text-white">{formatCurrency(totalClient)}</p>
            </div>
            <div>
              <p className="text-xs text-[#9a958b]">Total da Infinity</p>
              <p className="mt-1 font-semibold text-white">{formatCurrency(totalInfinity)}</p>
            </div>
          </div>
        ) : null}

        {saveError ? (
          <p className="rounded-xl border border-[#b46c5d]/30 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]">
            {saveError}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setReviewValues(null);
              setSaveError(null);
            }}
            className="min-h-12 rounded-2xl border border-white/10 px-4 text-sm font-semibold text-[#c9c2b4] active:bg-white/[0.05] disabled:opacity-50"
          >
            Voltar e corrigir
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={confirmSave}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 text-sm font-semibold text-[#0d0a05] active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {saving ? "Salvando tudo..." : "Confirmar e salvar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-[#d1a04f]/30 bg-[#3a2b18]/60 p-4 text-sm text-[#f3dfae] space-y-0.5">
        <p className="font-semibold text-white">{clientName}</p>
        {phone ? <p className="text-[#9a958b]">{phone}</p> : null}
        <p className="mt-1 text-xs text-[#9a958b]">
          {fields.length} máquina{fields.length === 1 ? "" : "s"}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="occurredAt">
              Data da conferência
            </label>
            <input id="occurredAt" type="date" className={fieldClass} {...form.register("occurredAt")} />
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
          {fields.map((field, index) => (
            <MachineFieldset
              key={field.id}
              index={index}
              form={form}
              expanded={expandedIndex === index}
              onToggle={() => setExpandedIndex((cur) => (cur === index ? null : index))}
              watchedMachine={watchedMachines[index]}
              hideFinancials={hideFinancials}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-[#d1a04f]/25 bg-[#2a2318]/45 p-4">
          <p className="text-sm font-semibold text-white">Dívida do cliente neste fechamento</p>
          <p className="mt-1 text-xs text-[#9a958b]">
            Informe uma única vez para toda a visita, independentemente da quantidade de máquinas.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" {...form.register("previousCustomerDebt")} />
            {!hideFinancials ? (
              <div className="space-y-1.5">
                <label className={labelClass}>Dívida anterior do cliente</label>
                <div className="flex min-h-12 items-center rounded-2xl border border-[rgba(245,241,232,0.1)] bg-white/[0.025] px-4 py-3 text-base font-semibold text-white">
                  {formatCurrency(watchedPreviousCustomerDebt)}
                </div>
              </div>
            ) : null}
            {!hideFinancials ? (
              <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <p className={labelClass}>Dívida gerada automaticamente</p>
                <p className="text-base font-semibold text-white">
                  {formatCurrency(automaticCustomerDebt.generatedDebtAmount)}
                </p>
                <p className={hintClass}>Parte do cliente que ficou negativa neste fechamento.</p>
              </div>
            ) : null}
            <input type="hidden" {...form.register("customerDebtDiscounted")} />
            {!hideFinancials ? (
              <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <p className={labelClass}>Dívida descontada automaticamente</p>
                <p className="text-base font-semibold text-white">
                  {formatCurrency(automaticCustomerDebt.customerDebtDiscounted)}
                </p>
                <p className={hintClass}>Usa a parte positiva do cliente para abater a dívida.</p>
              </div>
            ) : null}
            {!hideFinancials ? (
              <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <p className={labelClass}>Saldo final da dívida</p>
                <p className="text-base font-semibold text-white">
                  {formatCurrency(automaticCustomerDebt.finalCustomerDebt)}
                </p>
                <p className={hintClass}>Anterior + gerada − descontada.</p>
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onAddMoreMachines}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[#f3dfae] underline underline-offset-2 transition hover:text-white active:text-white"
        >
          <Plus className="size-3.5" />
          Adicionar mais máquinas para {clientName}
        </button>

        {Object.keys(form.formState.errors).length > 0 ? (
          <div className="rounded-2xl border border-[#b46c5d]/35 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]">
            <p className="font-medium">Falta corrigir para salvar:</p>
            <p className="mt-1 text-[13px]">
              Confira os dados do fechamento e as máquinas marcadas — alguma foto ou campo está faltando.
            </p>
          </div>
        ) : null}

        {saveError ? <p className="text-sm text-[#d59a8b]">{saveError}</p> : null}

        {isReceiptTestClient(clientName) ? (
          <button
            type="button"
            onClick={openReceiptPreview}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#25d366]/35 bg-[#0d1f14] px-4 py-3.5 text-sm font-semibold text-[#25d366] transition active:scale-[0.99]"
          >
            <ReceiptText className="size-4" />
            Abrir comprovante de teste — não salva
          </button>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] active:scale-[0.99] active:bg-[#daa855] disabled:opacity-70"
        >
          <ArrowRight className="size-4" />
          Revisar visita
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Ponto de entrada: resolve se ja existe cliente (initialClientId, vindo do
// picker da Visita) e delega pro cadastro ou pra visita em bloco.
// ──────────────────────────────────────────────────────────────────────────

export function SlotForm({
  hideFinancials = false,
  initialClientName = "",
  initialPhone = "",
  initialClientId,
}: {
  hideFinancials?: boolean;
  initialClientName?: string;
  initialPhone?: string;
  initialClientId?: string;
} = {}) {
  const [resolvedClientName, setResolvedClientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(initialClientId));
  const [addingMoreFor, setAddingMoreFor] = useState<string | null>(null);

  useEffect(() => {
    if (!initialClientId) return;
    let cancelled = false;
    getClientPrefillDataAction("h-caca-niquel", initialClientId)
      .then((data) => {
        if (!cancelled && data && data.kind === "slot-machine") {
          setResolvedClientName(data.clientName);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialClientId]);

  if (loading) {
    return <p className="text-sm text-slate-400">Carregando dados do cliente...</p>;
  }

  if (addingMoreFor) {
    return (
      <SlotRegisterForm
        addingToClientName={addingMoreFor}
        onRegistered={(clientName) => {
          setAddingMoreFor(null);
          setResolvedClientName(clientName);
        }}
      />
    );
  }

  if (resolvedClientName) {
    return (
      <SlotVisitForm
        key={resolvedClientName}
        hideFinancials={hideFinancials}
        clientName={resolvedClientName}
        onAddMoreMachines={() => setAddingMoreFor(resolvedClientName)}
      />
    );
  }

  return (
    <SlotRegisterForm
      initialClientName={initialClientName}
      initialPhone={initialPhone}
      onRegistered={(clientName) => setResolvedClientName(clientName)}
    />
  );
}
