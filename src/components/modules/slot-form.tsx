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
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { fetchAddressByCep } from "@/lib/cep";
import { formatCurrency } from "@/lib/format";
import { buildMapsLink } from "@/lib/maps";
import { maskCep, maskCpf, maskPhone, withMask } from "@/lib/masks";
import { isValidCpf } from "@/lib/validators";
import {
  getClientPrefillDataAction,
  getSlotClientMachinesAction,
  registerSlotClientAction,
} from "@/server/actions/module-record-actions";
import { PhotoCaptureInput } from "./photo-capture-input";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";

function getFile(value: unknown) {
  const file = Array.isArray(value) ? value[0] : (value as FileList | undefined)?.[0];
  return file instanceof File ? file : undefined;
}

async function uploadFile(file: File, category: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  const response = await fetch("/api/upload", { method: "POST", body: formData });
  if (!response.ok) return null;
  const result = (await response.json()) as { id: string };
  return result.id;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
      });
      onRegistered(result.clientName);
    } catch {
      setSaveError("Não foi possível cadastrar. Confira os campos e tente novamente.");
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
                    className="shrink-0 rounded-xl border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-3 text-xs font-semibold text-[#f3dfae] disabled:opacity-60"
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
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8aa17c] underline-offset-2 hover:underline"
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
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
    customerDebt: z.coerce.number().min(0),
    currentIncome: z.coerce.number().min(0),
    previousIncome: z.coerce.number().min(0),
    currentExpense: z.coerce.number().min(0),
    previousExpense: z.coerce.number().min(0),
    percentageSplit: z.coerce.number().min(0).max(100),
    conferenceCount: z.coerce.number().min(0),
    negativeAmount: z.coerce.number().min(0),
    feedingNegativeAmount: z.coerce.number().min(0),
    customerDebtDiscounted: z.coerce.number().min(0),
    generatedDebtAmount: z.coerce.number().min(0),
    debtMode: z.enum(["NONE", "DEBT", "NEGATIVE"]),
    screenPhoto: z.any().optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.included) return;
    const photo = (data.screenPhoto as FileList | undefined)?.[0];
    if (!photo) {
      ctx.addIssue({ code: "custom", path: ["screenPhoto"], message: "Tire uma foto da tela antes de salvar." });
    }
  });

const visitSchema = z.object({
  occurredAt: z.string().min(1, "Informe a data."),
  paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
  machines: z.array(visitMachineSchema).min(1),
});

type VisitInput = z.input<typeof visitSchema>;
type VisitValues = z.output<typeof visitSchema>;

function computeMachineSplit(m: {
  currentIncome: number;
  previousIncome: number;
  currentExpense: number;
  previousExpense: number;
  percentageSplit: number;
  negativeAmount: number;
  feedingNegativeAmount: number;
  customerDebtDiscounted: number;
  generatedDebtAmount: number;
}) {
  const incomeDifference = m.currentIncome - m.previousIncome;
  const expenseDifference = m.currentExpense - m.previousExpense;
  const netRevenue = incomeDifference - expenseDifference;
  const totalNegative = m.negativeAmount + m.feedingNegativeAmount;
  const adjustedTotal = netRevenue - totalNegative;
  const clientShareBase = adjustedTotal * (m.percentageSplit / 100);
  const houseShareBase = adjustedTotal - clientShareBase;
  const clientShareFinal = clientShareBase - m.customerDebtDiscounted;
  const houseAmount = houseShareBase - m.generatedDebtAmount;
  return { incomeDifference, expenseDifference, netRevenue, clientShareFinal, houseAmount };
}

type MachineResult = {
  clientMachineNumber: number;
  ok: boolean;
  clientShareFinal: number;
  houseAmount: number;
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
    negativeAmount: Number(watchedMachine?.negativeAmount ?? 0),
    feedingNegativeAmount: Number(watchedMachine?.feedingNegativeAmount ?? 0),
    customerDebtDiscounted: Number(watchedMachine?.customerDebtDiscounted ?? 0),
    generatedDebtAmount: Number(watchedMachine?.generatedDebtAmount ?? 0),
  });

  const machineErrors = form.formState.errors.machines?.[index];

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        included ? "border-[rgba(245,241,232,0.08)]" : "border-[rgba(245,241,232,0.05)] opacity-60"
      } bg-[#0b0f0e]/35`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-white">
          <input type="checkbox" {...form.register(`machines.${index}.included`)} />
          Máquina {clientMachineNumber}
        </label>
        {!hideFinancials && included ? (
          <span
            className={`ml-auto text-xs font-medium ${
              split.houseAmount < 0 ? "text-[#f87171]" : "text-[#8cc490]"
            }`}
          >
            {formatCurrency(split.houseAmount)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-[#9a958b] transition hover:text-white"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {expanded && included ? (
        <div className="space-y-4 border-t border-[rgba(245,241,232,0.08)] px-4 py-4">
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
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Entrada anterior</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.previousIncome`)}
              />
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
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Saída anterior</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.previousExpense`)}
              />
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
              <label className={labelClass}>Conferências</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className={fieldClass}
                {...form.register(`machines.${index}.conferenceCount`)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Débito da máquina (saldo)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.negativeAmount`)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Negativo de alimentação</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.feedingNegativeAmount`)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClass}>Dívida do cliente (saldo)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.customerDebt`)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Dívida descontada agora</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.customerDebtDiscounted`)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Dívida gerada agora</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register(`machines.${index}.generatedDebtAmount`)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Modo</label>
              <select className={selectClass} {...form.register(`machines.${index}.debtMode`)}>
                <option value="NONE">Nenhum</option>
                <option value="DEBT">Dívida</option>
                <option value="NEGATIVE">Negativo</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Observações</label>
            <textarea className={textareaClass} {...form.register(`machines.${index}.notes`)} />
          </div>

          {!hideFinancials ? (
            <div className="rounded-xl border border-[#6f8790]/25 bg-[#27383a]/70 p-3 text-xs leading-5 text-[#d6e1de]/80">
              Receita líquida {formatCurrency(split.netRevenue)} · Cliente {formatCurrency(split.clientShareFinal)} · Casa{" "}
              {formatCurrency(split.houseAmount)}
            </div>
          ) : null}
        </div>
      ) : null}
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
  const [results, setResults] = useState<MachineResult[] | null>(null);

  const form = useForm<VisitInput, unknown, VisitValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      occurredAt: todayStr(),
      paymentMethod: "PIX",
      machines: [],
    },
  });
  const { fields, replace } = useFieldArray({ control: form.control, name: "machines" });

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    setResults(null);
    getSlotClientMachinesAction(clientName)
      .then((data) => {
        setPhone(data.phone);
        replace(
          data.machines.map((m) => ({
            machineId: m.id,
            clientMachineNumber: m.clientMachineNumber,
            included: m.active,
            customerDebt: m.customerDebt,
            currentIncome: 0,
            previousIncome: m.previousIncome,
            currentExpense: 0,
            previousExpense: m.previousExpense,
            percentageSplit: 50,
            conferenceCount: 0,
            negativeAmount: m.machineDebt,
            feedingNegativeAmount: 0,
            customerDebtDiscounted: 0,
            generatedDebtAmount: 0,
            debtMode: "NONE" as const,
            notes: "",
          })),
        );
        setExpandedIndex(0);
      })
      .catch(() => setLoadError("Erro ao carregar as máquinas deste cliente."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName]);

  const watchedMachines = useWatch({ control: form.control, name: "machines" }) ?? [];

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    setSaveError(null);

    const included = values.machines.filter((m) => m.included);
    if (included.length === 0) {
      setSaveError("Selecione ao menos uma máquina pra fechar.");
      setSaving(false);
      return;
    }

    const outcomes: MachineResult[] = [];
    for (const m of included) {
      const split = computeMachineSplit(m);
      let ok = true;
      try {
        const screenPhoto = getFile(m.screenPhoto);
        const screenPhotoFileId = screenPhoto ? await uploadFile(screenPhoto, "PHOTO") : null;
        const response = await fetch("/api/modules/h-caca-niquel/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            machineId: m.machineId,
            newClient: false,
            customerDebt: Number(m.customerDebt),
            ppValue: 0,
            initialAmount: 0,
            initialAmountMode: "NONE",
            optionalGreedAmount: 0,
            occurredAt: values.occurredAt,
            currentIncome: Number(m.currentIncome),
            previousIncome: Number(m.previousIncome),
            currentExpense: Number(m.currentExpense),
            previousExpense: Number(m.previousExpense),
            percentageSplit: Number(m.percentageSplit),
            conferenceCount: Number(m.conferenceCount),
            negativeAmount: Number(m.negativeAmount),
            feedingNegativeAmount: Number(m.feedingNegativeAmount),
            customerDebtDiscounted: Number(m.customerDebtDiscounted),
            generatedDebtAmount: Number(m.generatedDebtAmount),
            debtMode: m.debtMode,
            paymentMethod: values.paymentMethod,
            screenPhotoFileId: screenPhotoFileId ?? undefined,
            notes: m.notes,
          }),
        });
        ok = response.ok;
      } catch {
        ok = false;
      }
      outcomes.push({
        clientMachineNumber: m.clientMachineNumber,
        ok,
        clientShareFinal: split.clientShareFinal,
        houseAmount: split.houseAmount,
      });
    }

    setResults(outcomes);
    if (outcomes.some((o) => !o.ok)) {
      setSaveError("Uma ou mais máquinas não foram salvas no servidor — confira a conexão.");
    }
    setSaving(false);
  });

  if (loading) {
    return <p className="text-sm text-slate-400">Carregando máquinas de {clientName}...</p>;
  }
  if (loadError) {
    return <p className="text-sm text-[#d59a8b]">{loadError}</p>;
  }

  if (results) {
    const totalCliente = results.reduce((s, r) => s + r.clientShareFinal, 0);
    const totalCasa = results.reduce((s, r) => s + r.houseAmount, 0);
    return (
      <div className="space-y-4">
        <article className="rounded-[28px] border border-[#8aa17c]/25 bg-[#243528]/72 p-5">
          <div className="flex items-center gap-2 text-[#dbe6d4]">
            <ReceiptText className="size-4" />
            <p className="font-medium">Visita de {clientName} salva</p>
          </div>
          <div className="mt-4 space-y-1.5 text-sm text-[#dbe6d4]/85">
            {results.map((r) => (
              <div key={r.clientMachineNumber} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {r.ok ? (
                    <CheckCircle2 className="size-3.5 text-[#8aa17c]" />
                  ) : (
                    <X className="size-3.5 text-[#f87171]" />
                  )}
                  Máquina {r.clientMachineNumber}
                </span>
                {hideFinancials ? null : <span>{formatCurrency(r.houseAmount)}</span>}
              </div>
            ))}
          </div>
          {hideFinancials ? null : (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#8aa17c]/20 pt-3 text-sm">
              <p>
                Total cliente: <span className="font-semibold text-white">{formatCurrency(totalCliente)}</span>
              </p>
              <p>
                Total casa: <span className="font-semibold text-white">{formatCurrency(totalCasa)}</span>
              </p>
            </div>
          )}
          {saveError ? <p className="mt-3 text-sm text-[#f0c9ad]">{saveError}</p> : null}
        </article>
        <button
          type="button"
          onClick={() => setResults(null)}
          className="text-xs font-semibold text-[#9a958b] underline underline-offset-2 hover:text-white"
        >
          Fazer outra visita
        </button>
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

        <button
          type="button"
          onClick={onAddMoreMachines}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#f3dfae] underline underline-offset-2 hover:text-white"
        >
          <Plus className="size-3.5" />
          Adicionar mais máquinas para {clientName}
        </button>

        {Object.keys(form.formState.errors).length > 0 ? (
          <div className="rounded-2xl border border-[#b46c5d]/35 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]">
            <p className="font-medium">Falta corrigir para salvar:</p>
            <p className="mt-1 text-[13px]">
              Confira as máquinas marcadas para fechar hoje — alguma foto ou campo está faltando.
            </p>
          </div>
        ) : null}

        {saveError ? <p className="text-sm text-[#d59a8b]">{saveError}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
        >
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Salvar visita
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
    if (!initialClientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getClientPrefillDataAction("h-caca-niquel", initialClientId)
      .then((data) => {
        if (data && data.kind === "slot-machine") setResolvedClientName(data.clientName);
      })
      .finally(() => setLoading(false));
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
