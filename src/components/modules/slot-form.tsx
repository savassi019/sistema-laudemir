"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, Plus, ReceiptText, TriangleAlert, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { fetchAddressByCep } from "@/lib/cep";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { buildMapsLink } from "@/lib/maps";
import { maskCep, maskCpf, maskPhone, withMask } from "@/lib/masks";
import { isValidCpf } from "@/lib/validators";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const schema = z
  .object({
    uniqueMachineNumber: z.string().min(1, "Informe o numero unico."),
    newClient: z.boolean().default(false),
    clientName: z.string().optional(),
    phone: z.string().optional(),
    cpf: z.string().optional(),
    cep: z.string().optional(),
    street: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    customerDebt: z.coerce.number().min(0),
    ppValue: z.coerce.number().min(0),
    initialAmount: z.coerce.number().min(0),
    initialAmountMode: z.enum(["NONE", "DEBT", "NEGATIVE"]),
    optionalGreedAmount: z.coerce.number().min(0),
    active: z.boolean().default(true),
    occurredAt: z.string().min(1, "Informe a data."),
    currentIncome: z.coerce.number().min(0),
    previousIncome: z.coerce.number().min(0),
    currentExpense: z.coerce.number().min(0),
    previousExpense: z.coerce.number().min(0),
    percentageSplit: z.coerce.number().min(0).max(100),
    conferenceCount: z.coerce.number().min(0),
    negativeEntries: z.array(z.object({ amount: z.coerce.number().min(0) })),
    feedingNegativeAmount: z.coerce.number().min(0),
    customerDebtDiscounted: z.coerce.number().min(0),
    generatedDebtAmount: z.coerce.number().min(0),
    debtMode: z.enum(["NONE", "DEBT", "NEGATIVE"]),
    paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
    notes: z.string().optional(),
  })
  .refine((data) => !data.cpf?.trim() || isValidCpf(data.cpf), {
    message: "CPF invalido.",
    path: ["cpf"],
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  uniqueMachineNumber: string;
  clientLabel: string;
  occurredAt: string;
  currentIncome: number;
  currentExpense: number;
  percentageSplit: number;
  clientShareFinal: number;
  houseAmount: number;
  conferenceCount: number;
  paymentMethod: string;
  notes?: string;
};

const modeLabels: Record<string, string> = {
  NONE: "Nenhum",
  DEBT: "Dívida",
  NEGATIVE: "Negativo",
};

export function SlotForm({ hideFinancials = false }: { hideFinancials?: boolean } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      active: true,
      newClient: false,
      initialAmountMode: "NONE",
      debtMode: "NONE",
      paymentMethod: "PIX",
      percentageSplit: 50,
      customerDebt: 0,
      ppValue: 0,
      initialAmount: 0,
      optionalGreedAmount: 0,
      currentIncome: 0,
      previousIncome: 0,
      currentExpense: 0,
      previousExpense: 0,
      conferenceCount: 0,
      negativeEntries: [{ amount: 0 }],
      feedingNegativeAmount: 0,
      customerDebtDiscounted: 0,
      generatedDebtAmount: 0,
    },
  });

  const negativeEntries = useFieldArray({ control: form.control, name: "negativeEntries" });

  const currentIncome = Number(useWatch({ control: form.control, name: "currentIncome" }) ?? 0);
  const currentExpense = Number(useWatch({ control: form.control, name: "currentExpense" }) ?? 0);
  const previousIncome = Number(useWatch({ control: form.control, name: "previousIncome" }) ?? 0);
  const previousExpense = Number(useWatch({ control: form.control, name: "previousExpense" }) ?? 0);
  const percentageSplit = Number(
    useWatch({ control: form.control, name: "percentageSplit" }) ?? 0,
  );
  const watchedNegativeEntries = useWatch({ control: form.control, name: "negativeEntries" }) ?? [];
  const feedingNegativeAmount =
    Number(useWatch({ control: form.control, name: "feedingNegativeAmount" }) ?? 0);
  const optionalGreedAmount =
    Number(useWatch({ control: form.control, name: "optionalGreedAmount" }) ?? 0);
  const customerDebtDiscounted =
    Number(useWatch({ control: form.control, name: "customerDebtDiscounted" }) ?? 0);
  const generatedDebtAmount =
    Number(useWatch({ control: form.control, name: "generatedDebtAmount" }) ?? 0);
  const newClient = Boolean(useWatch({ control: form.control, name: "newClient" }) ?? false);
  const initialAmountMode = String(
    useWatch({ control: form.control, name: "initialAmountMode" }) ?? "NONE",
  );
  const initialAmount = Number(useWatch({ control: form.control, name: "initialAmount" }) ?? 0);
  const ppValue = Number(useWatch({ control: form.control, name: "ppValue" }) ?? 0);
  const customerDebt = Number(useWatch({ control: form.control, name: "customerDebt" }) ?? 0);

  const manualNegativeAmount = useMemo(
    () => watchedNegativeEntries.reduce((sum, entry) => sum + Number(entry?.amount ?? 0), 0),
    [watchedNegativeEntries],
  );
  const initialNegativeBonus = newClient && initialAmountMode === "NEGATIVE" ? initialAmount : 0;
  const negativeAmount = manualNegativeAmount + initialNegativeBonus;

  const baseDebt = newClient ? (initialAmountMode === "DEBT" ? initialAmount : 0) : customerDebt;
  const effectiveCustomerDebt = Math.max(baseDebt - ppValue, 0);

  const incomeDifference = useMemo(
    () => currentIncome - previousIncome,
    [currentIncome, previousIncome],
  );
  const expenseDifference = useMemo(
    () => currentExpense - previousExpense,
    [currentExpense, previousExpense],
  );
  const netRevenue = incomeDifference - expenseDifference;
  const totalNegative = negativeAmount + feedingNegativeAmount;
  const adjustedTotal = netRevenue - totalNegative;
  const clientShareBase = adjustedTotal * (percentageSplit / 100);
  const houseShareBase = adjustedTotal - clientShareBase;
  const clientShareAfterGreed = clientShareBase - optionalGreedAmount;
  const houseShareAfterGreed = houseShareBase + optionalGreedAmount;
  const clientShareFinal = clientShareAfterGreed - customerDebtDiscounted;
  const houseAmount = houseShareAfterGreed - generatedDebtAmount;

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

    let clientLabel = values.clientName || values.uniqueMachineNumber;

    try {
      const response = await fetch("/api/modules/h-caca-niquel/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uniqueMachineNumber: values.uniqueMachineNumber,
          newClient: values.newClient,
          clientName: values.clientName,
          phone: values.phone,
          cpf: values.cpf,
          cep: values.cep,
          street: values.street,
          neighborhood: values.neighborhood,
          city: values.city,
          state: values.state,
          customerDebt: Number(values.customerDebt),
          ppValue: Number(values.ppValue),
          initialAmount: Number(values.initialAmount),
          initialAmountMode: values.initialAmountMode,
          optionalGreedAmount: Number(values.optionalGreedAmount),
          active: values.active,
          occurredAt: values.occurredAt,
          currentIncome: Number(values.currentIncome),
          previousIncome: Number(values.previousIncome),
          currentExpense: Number(values.currentExpense),
          previousExpense: Number(values.previousExpense),
          percentageSplit: Number(values.percentageSplit),
          conferenceCount: Number(values.conferenceCount),
          negativeAmount,
          feedingNegativeAmount: Number(values.feedingNegativeAmount),
          customerDebtDiscounted: Number(values.customerDebtDiscounted),
          generatedDebtAmount: Number(values.generatedDebtAmount),
          debtMode: values.debtMode,
          paymentMethod: values.paymentMethod,
          notes: values.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar o H.");
      }

      const result = (await response.json()) as { record?: { summary?: string } };
      if (result.record?.summary) {
        clientLabel = result.record.summary;
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

    setReceipt({
      uniqueMachineNumber: values.uniqueMachineNumber,
      clientLabel,
      occurredAt: values.occurredAt,
      currentIncome,
      currentExpense,
      percentageSplit,
      clientShareFinal,
      houseAmount,
      conferenceCount: Number(values.conferenceCount),
      paymentMethod: values.paymentMethod,
      notes: values.notes,
    });

    setLoading(false);

    submittingRef.current = false;
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-[#d1a04f]/28 bg-[#3a2b18]/72 p-4 text-sm leading-6 text-[#f3dfae]">
        <p className="font-medium">Regra do H</p>
        <p>Controle entrada, saída, 50 por cento, dívida, negativo e conferências.</p>
      </div>

      {hideFinancials ? null : (
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Receita líquida</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(netRevenue)}</p>
          </article>
          <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cliente</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(clientShareFinal)}</p>
          </article>
          <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Casa</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(houseAmount)}</p>
          </article>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="uniqueMachineNumber">
              Número único da máquina
            </label>
            <input
              id="uniqueMachineNumber"
              className={fieldClass}
              {...form.register("uniqueMachineNumber")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="occurredAt">
              Data da conferência
            </label>
            <input
              id="occurredAt"
              type="date"
              className={fieldClass}
              {...form.register("occurredAt")}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
          <input type="checkbox" {...form.register("newClient")} />
          Novo cliente nesta máquina (atribui novo número de sequência e zera a dívida)
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
              Cadastro de cliente / ponto
            </p>
            <label className={labelClass} htmlFor="clientName">
              Nome do cliente
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
            <input id="state" className={fieldClass} {...form.register("state")} />
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

        {newClient ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="initialAmount">
                Valor inicial do cliente
              </label>
              <input
                id="initialAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                {...form.register("initialAmount")}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="initialAmountMode">
                Valor inicial é
              </label>
              <select id="initialAmountMode" className={selectClass} {...form.register("initialAmountMode")}>
                <option value="NONE">Nenhum</option>
                <option value="DEBT">Dívida</option>
                <option value="NEGATIVE">Negativo</option>
              </select>
              <p className={hintClass}>Decisão do dono: o valor inicial entra como dívida do cliente ou como negativo da máquina.</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="currentIncome">
              Entrada atual
            </label>
            <input
              id="currentIncome"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("currentIncome")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="previousIncome">
              Entrada anterior
            </label>
            <input
              id="previousIncome"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("previousIncome")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="currentExpense">
              Saída atual
            </label>
            <input
              id="currentExpense"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("currentExpense")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="previousExpense">
              Saída anterior
            </label>
            <input
              id="previousExpense"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("previousExpense")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="percentageSplit">
              Percentual do cliente
            </label>
            <input
              id="percentageSplit"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              className={fieldClass}
              {...form.register("percentageSplit")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="conferenceCount">
              Conferências
            </label>
            <input
              id="conferenceCount"
              type="number"
              min="0"
              className={fieldClass}
              {...form.register("conferenceCount")}
            />
            <p className={hintClass}>Conferência ilimitada — registre quantas forem feitas.</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
            Negativo (abastecimento da máquina)
          </p>
          {negativeEntries.fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={fieldClass}
                placeholder={`Negativo ${index + 1}`}
                {...form.register(`negativeEntries.${index}.amount`)}
              />
              {negativeEntries.fields.length > 1 ? (
                <button
                  type="button"
                  onClick={() => negativeEntries.remove(index)}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[#9a958b] transition hover:text-white"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => negativeEntries.append({ amount: 0 })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-[#c9c2b4] transition hover:text-white"
          >
            <Plus className="size-3.5" />
            Adicionar negativo
          </button>
          <p className={hintClass}>Pode haver mais de um negativo no mesmo fechamento. Total: {formatCurrency(negativeAmount)}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="feedingNegativeAmount">
              Negativo na alimentação (opcional)
            </label>
            <input
              id="feedingNegativeAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("feedingNegativeAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="optionalGreedAmount">
              Ganância (opcional)
            </label>
            <input
              id="optionalGreedAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("optionalGreedAmount")}
            />
            <p className={hintClass}>Valor extra descontado do cliente e somado à casa.</p>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="customerDebt">
              Dívida do cliente (saldo)
            </label>
            <input
              id="customerDebt"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("customerDebt")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="customerDebtDiscounted">
              Dívida descontada agora
            </label>
            <input
              id="customerDebtDiscounted"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("customerDebtDiscounted")}
            />
            <p className={hintClass}>Descontado só da parte do cliente, depois da divisão dos 50%.</p>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="generatedDebtAmount">
              Dívida gerada agora
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
            <p className={hintClass}>Novo valor que a casa adianta ao cliente neste fechamento.</p>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="ppValue">
              P.P. (pagamento pendente)
            </label>
            <input
              id="ppValue"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("ppValue")}
            />
            <p className={hintClass}>
              Abate do saldo de dívida do cliente. Dívida efetiva: {formatCurrency(effectiveCustomerDebt)}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
          <input type="checkbox" {...form.register("active")} />
          Máquina ativa
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="debtMode">
              Este fechamento é
            </label>
            <select id="debtMode" className={selectClass} {...form.register("debtMode")}>
              <option value="NONE">{modeLabels.NONE}</option>
              <option value="DEBT">{modeLabels.DEBT}</option>
              <option value="NEGATIVE">{modeLabels.NEGATIVE}</option>
            </select>
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
          <label className={labelClass} htmlFor="notes">
            Observações
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        {hideFinancials ? null : (
          <div className="rounded-[24px] border border-[#6f8790]/25 bg-[#27383a]/70 p-4">
            <div className="flex items-center gap-2 text-[#d6e1de]">
              <TriangleAlert className="size-4" />
              <p className="font-medium">Conferência rápida</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#d6e1de]/80">
              Diferença entrada {formatCurrency(incomeDifference)} | Diferença saída {formatCurrency(expenseDifference)} |
              Receita líquida {formatCurrency(netRevenue)} | Negativo total {formatCurrency(totalNegative)}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar H
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
            <p className="font-medium">Registro do H salvo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Máquina: {receipt.uniqueMachineNumber}</p>
            <p>{receipt.clientLabel}</p>
            <p>Data: {formatShortDate(receipt.occurredAt)}</p>
            <p>Conferências: {receipt.conferenceCount}</p>
            {hideFinancials ? null : (
              <>
                <p>Cliente: {formatCurrency(receipt.clientShareFinal)}</p>
                <p>Casa: {formatCurrency(receipt.houseAmount)}</p>
              </>
            )}
            <p>Pagamento: {receipt.paymentMethod}</p>
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p> : null}
          <WhatsAppReceiptButton
            message={[
              "*Comprovante H (Caça-Níquel)*",
              `Máquina: ${receipt.uniqueMachineNumber}`,
              receipt.clientLabel,
              `Data: ${formatShortDate(receipt.occurredAt)}`,
              `Entrada: ${formatCurrency(receipt.currentIncome)}`,
              `Saída: ${formatCurrency(receipt.currentExpense)}`,
              `*Cliente: ${formatCurrency(receipt.clientShareFinal)}*`,
              `Casa: ${formatCurrency(receipt.houseAmount)}`,
              `Pagamento: ${receipt.paymentMethod}`,
            ].join("\n")}
          />
        </article>
      ) : null}
    </div>
  );
}
