"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText, ShieldCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const schema = z.object({
  clientCode: z.string().min(1, "Informe o código do cliente."),
  clientName: z.string().min(2, "Informe o cliente."),
  amount: z.coerce.number().min(0),
  contractDate: z.string().min(1, "Informe a data."),
  year: z.coerce.number().min(2000),
  percentage: z.coerce.number().min(0).max(100),
  monthlyInterest: z.coerce.number().min(0).max(100),
  installmentFixed: z.boolean().default(false),
  guaranteeEnabled: z.boolean().default(false),
  signatureLink: z.string().optional(),
  signatureFile: z.any().optional(),
  streetLoanAmount: z.coerce.number().min(0),
  monthlyInterestTotal: z.coerce.number().min(0),
  generalPercentageAvg: z.coerce.number().min(0).max(100),
  expenseAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
  status: z.enum(["DRAFT", "OPEN", "ACTIVE", "CLOSED"]),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  clientCode: string;
  clientName: string;
  contractDate: string;
  amount: number;
  monthlyCharge: number;
  totalCharge: number;
  expenseAmount: number;
  paymentMethod: string;
  status: string;
  signatureLink?: string;
  signatureFileName?: string;
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

export function MachineContractForm({ hideFinancials = false }: { hideFinancials?: boolean } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      installmentFixed: false,
      guaranteeEnabled: false,
      percentage: 0,
      monthlyInterest: 0,
      streetLoanAmount: 0,
      monthlyInterestTotal: 0,
      generalPercentageAvg: 0,
      expenseAmount: 0,
      paymentMethod: "PIX",
      status: "DRAFT",
      year: new Date().getFullYear(),
      amount: 0,
    },
  });

  const amount = Number(useWatch({ control: form.control, name: "amount" }) ?? 0);
  const monthlyInterest = Number(
    useWatch({ control: form.control, name: "monthlyInterest" }) ?? 0,
  );
  const streetLoanAmount = Number(
    useWatch({ control: form.control, name: "streetLoanAmount" }) ?? 0,
  );
  const monthlyCharge = useMemo(
    () => amount * (monthlyInterest / 100),
    [amount, monthlyInterest],
  );
  const totalCharge = monthlyCharge + streetLoanAmount;

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    const signatureFile = getFile(values.signatureFile);
    const signatureFileId = signatureFile ? await uploadFile(signatureFile, "CONTRACT") : null;

    try {
      const response = await fetch("/api/modules/credito-financeiro/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode: values.clientCode,
          clientName: values.clientName,
          amount: Number(values.amount),
          contractDate: values.contractDate,
          year: Number(values.year),
          percentage: Number(values.percentage),
          monthlyInterest: Number(values.monthlyInterest),
          installmentFixed: values.installmentFixed,
          guaranteeEnabled: values.guaranteeEnabled,
          signatureLink: values.signatureLink,
          signatureFileId,
          streetLoanAmount: Number(values.streetLoanAmount),
          monthlyInterestTotal: Number(values.monthlyInterestTotal),
          generalPercentageAvg: Number(values.generalPercentageAvg),
          expenseAmount: Number(values.expenseAmount),
          paymentMethod: values.paymentMethod,
          status: values.status,
          notes: values.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar o credito.");
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

    setReceipt({
      clientCode: values.clientCode,
      clientName: values.clientName,
      contractDate: values.contractDate,
      amount,
      monthlyCharge,
      totalCharge,
      expenseAmount: Number(values.expenseAmount),
      paymentMethod: values.paymentMethod,
      status: values.status,
      signatureLink: values.signatureLink,
      signatureFileName: signatureFile?.name,
      notes: values.notes,
    });

    setLoading(false);

    submittingRef.current = false;
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-[#d1a04f]/28 bg-[#3a2b18]/72 p-4 text-sm leading-6 text-[#f3dfae]">
        <p className="font-medium">Crédito financeiro</p>
        <p>Contrato, juros, garantia, assinatura e saldo previsto em uma tela curta.</p>
      </div>

      {hideFinancials ? null : (
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Valor</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(amount)}</p>
          </article>
          <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Juros</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(monthlyCharge)}</p>
          </article>
          <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(totalCharge)}</p>
          </article>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
              Cadastro de cliente
            </p>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="clientCode">
              Código do cliente
            </label>
            <input id="clientCode" className={fieldClass} {...form.register("clientCode")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="clientName">
              Nome do cliente
            </label>
            <input id="clientName" className={fieldClass} {...form.register("clientName")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="contractDate">
              Data do contrato
            </label>
            <input
              id="contractDate"
              type="date"
              className={fieldClass}
              {...form.register("contractDate")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="year">
              Ano
            </label>
            <input id="year" type="number" min="2000" className={fieldClass} {...form.register("year")} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="amount">
              Valor principal
            </label>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("amount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="percentage">
              Percentual
            </label>
            <input
              id="percentage"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              className={fieldClass}
              {...form.register("percentage")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="monthlyInterest">
              Juros mensal
            </label>
            <input
              id="monthlyInterest"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              className={fieldClass}
              {...form.register("monthlyInterest")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="streetLoanAmount">
              Valor de rua
            </label>
            <input
              id="streetLoanAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("streetLoanAmount")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="monthlyInterestTotal">
              Juros total
            </label>
            <input
              id="monthlyInterestTotal"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("monthlyInterestTotal")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="generalPercentageAvg">
              Média geral %
            </label>
            <input
              id="generalPercentageAvg"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className={fieldClass}
              {...form.register("generalPercentageAvg")}
            />
          </div>
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

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("installmentFixed")} />
            Parcela fixa
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("guaranteeEnabled")} />
            Garantia ativa
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
              Assinatura (gov.br)
            </p>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="signatureLink">
              Link da assinatura no gov.br
            </label>
            <input id="signatureLink" className={fieldClass} {...form.register("signatureLink")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="signatureFile">
              Anexar PDF assinado
            </label>
            <input id="signatureFile" type="file" className={fieldClass} {...form.register("signatureFile")} />
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="status">
            Status
          </label>
          <select id="status" className={selectClass} {...form.register("status")}>
            <option value="DRAFT">Rascunho</option>
            <option value="OPEN">Aberto</option>
            <option value="ACTIVE">Ativo</option>
            <option value="CLOSED">Fechado</option>
          </select>
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
              <ShieldCheck className="size-4" />
              <p className="font-medium">Resumo do contrato</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#d6e1de]/80">
              Valor de rua {formatCurrency(streetLoanAmount)} | Juros mensal {formatCurrency(monthlyCharge)} |
              Total projetado {formatCurrency(totalCharge)}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar crédito
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
            <p className="font-medium">Contrato salvo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Código: {receipt.clientCode}</p>
            <p>Cliente: {receipt.clientName}</p>
            {hideFinancials ? null : (
              <>
                <p>Valor: {formatCurrency(receipt.amount)}</p>
                <p>Juros: {formatCurrency(receipt.monthlyCharge)}</p>
                <p>Total: {formatCurrency(receipt.totalCharge)}</p>
              </>
            )}
            <p>Data: {formatShortDate(receipt.contractDate)}</p>
            {hideFinancials ? null : <p>Despesa: {formatCurrency(receipt.expenseAmount)}</p>}
            <p>Pagamento: {receipt.paymentMethod}</p>
            {receipt.signatureLink ? <p>Assinatura: {receipt.signatureLink}</p> : null}
            {receipt.signatureFileName ? <p>PDF assinado: {receipt.signatureFileName}</p> : null}
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p> : null}
          <WhatsAppReceiptButton
            message={[
              "*Comprovante Crédito Financeiro*",
              `Cliente: ${receipt.clientName}`,
              `Código: ${receipt.clientCode}`,
              `Data: ${formatShortDate(receipt.contractDate)}`,
              `*Valor: ${formatCurrency(receipt.amount)}*`,
              `Juros mensal: ${formatCurrency(receipt.monthlyCharge)}`,
              `Total projetado: ${formatCurrency(receipt.totalCharge)}`,
              `Despesa: ${formatCurrency(receipt.expenseAmount)}`,
              `Pagamento: ${receipt.paymentMethod}`,
              ...(receipt.signatureLink ? [`Assinatura: ${receipt.signatureLink}`] : []),
            ].join("\n")}
          />
        </article>
      ) : null}
    </div>
  );
}
