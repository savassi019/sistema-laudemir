"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  FileSignature,
  LoaderCircle,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { calculateCreditTerms } from "@/lib/credit-finance";
import { useIdempotentSubmission } from "@/hooks/use-idempotent-submission";
import { PAYMENT_METHOD_LABEL, rotuloDeStatus } from "@/lib/status-labels";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const schema = z.object({
  clientCode: z.string().min(1, "Informe o código do cliente."),
  clientName: z.string().min(2, "Informe o cliente."),
  amount: z.coerce.number().positive("Informe um valor maior que zero."),
  contractDate: z.string().min(1, "Informe a data."),
  dueDate: z.string().min(1, "Informe o primeiro vencimento."),
  installmentsCount: z.coerce.number().int().min(1).max(120),
  year: z.coerce.number().min(2000),
  monthlyInterest: z.coerce.number().min(0).max(100),
  guaranteeEnabled: z.boolean().default(false),
  signatureLink: z
    .union([z.string().url("Informe um link válido."), z.literal("")])
    .optional(),
  signatureFile: z.any().optional(),
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
  totalInterest: number;
  totalReceivable: number;
  installmentAmount: number;
  installmentsCount: number;
  dueDate: string;
  expenseAmount: number;
  paymentMethod: string;
  signatureLink?: string;
  signatureFileName?: string;
  notes?: string;
};

function FormSection({
  icon,
  step,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  step: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#101514]/82">
      <header className="flex items-start gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d1a04f]/25 bg-[#d1a04f]/10 text-[#e4bb70]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#bca979]">
            Etapa {step}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-white sm:text-lg">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
        </div>
      </header>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm text-[#e6a591]" role="alert">
      {message}
    </p>
  ) : null;
}

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
    throw new Error("Falha ao enviar o contrato assinado.");
  }

  const result = (await response.json()) as { id: string };
  return result.id;
}

export function MachineContractForm({ hideFinancials = false }: { hideFinancials?: boolean } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const submission = useIdempotentSubmission();
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      guaranteeEnabled: false,
      monthlyInterest: 0,
      installmentsCount: 1,
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
  const contractDate = useWatch({ control: form.control, name: "contractDate" }) ?? "";
  const installmentsCount = Number(
    useWatch({ control: form.control, name: "installmentsCount" }) ?? 1,
  );
  const credit = calculateCreditTerms(amount, monthlyInterest, installmentsCount);
  const contractYear = Number(contractDate.slice(0, 4)) || new Date().getFullYear();

  // The ref is an intentional immediate guard against two taps before React rerenders.
  // eslint-disable-next-line react-hooks/refs
  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);
    setReceipt(null);

    const signatureFile = getFile(values.signatureFile);

    try {
      const signatureFileId = signatureFile
        ? await uploadFile(signatureFile, "CONTRACT")
        : null;
      const response = await fetch("/api/modules/credito-financeiro/records", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": submission.key() },
        body: JSON.stringify({
          clientCode: values.clientCode,
          clientName: values.clientName,
          amount: Number(values.amount),
          contractDate: values.contractDate,
          dueDate: values.dueDate,
          installmentsCount: Number(values.installmentsCount),
          year: Number(values.contractDate.slice(0, 4)) || Number(values.year),
          monthlyInterest: Number(values.monthlyInterest),
          installmentFixed: Number(values.installmentsCount) > 1,
          guaranteeEnabled: values.guaranteeEnabled,
          signatureLink: values.signatureLink,
          signatureFileId,
          expenseAmount: Number(values.expenseAmount),
          paymentMethod: values.paymentMethod,
          status: values.status,
          notes: values.notes,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao salvar o credito.");
      }
      submission.complete();

      setReceipt({
        clientCode: values.clientCode,
        clientName: values.clientName,
        contractDate: values.contractDate,
        amount,
        totalInterest: credit.totalInterest,
        totalReceivable: credit.totalReceivable,
        installmentAmount: credit.installmentAmount,
        installmentsCount: credit.installmentsCount,
        dueDate: values.dueDate,
        expenseAmount: Number(values.expenseAmount),
        paymentMethod: values.paymentMethod,
        signatureLink: values.signatureLink,
        signatureFileName: signatureFile?.name,
        notes: values.notes,
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "O empréstimo não foi salvo. Confira a conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  });

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[#d1a04f]/25 bg-[linear-gradient(135deg,rgba(58,43,24,0.9),rgba(16,21,20,0.92))] p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d5b46e]">
          Crédito financeiro
        </p>
        <h2 className="mt-2 text-balance text-xl font-semibold text-white sm:text-2xl">
          Novo empréstimo
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d8cdb8]">
          Registre quem recebeu, quanto foi entregue, como será cobrado e os documentos do acordo.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <input type="hidden" {...form.register("year")} />

        <FormSection
          step="1"
          title="Cliente e data"
          description="Identifique a pessoa e o início do empréstimo."
          icon={<UserRound className="size-5" aria-hidden="true" />}
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="clientCode">
                Código do cliente
              </label>
              <input
                id="clientCode"
                autoComplete="off"
                spellCheck={false}
                className={fieldClass}
                {...form.register("clientCode")}
              />
              <FieldError message={form.formState.errors.clientCode?.message} />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="clientName">
                Nome do cliente
              </label>
              <input
                id="clientName"
                autoComplete="name"
                className={fieldClass}
                {...form.register("clientName")}
              />
              <FieldError message={form.formState.errors.clientName?.message} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="contractDate">
                Data do empréstimo
              </label>
              <input
                id="contractDate"
                type="date"
                autoComplete="off"
                className={fieldClass}
                {...form.register("contractDate")}
              />
              <FieldError message={form.formState.errors.contractDate?.message} />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="dueDate">
                Primeiro vencimento
              </label>
              <input
                id="dueDate"
                type="date"
                min={contractDate || undefined}
                autoComplete="off"
                className={fieldClass}
                {...form.register("dueDate")}
              />
              <FieldError message={form.formState.errors.dueDate?.message} />
            </div>
          </div>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300">
            <CalendarDays className="size-4 text-[#c7aa6a]" aria-hidden="true" />
            Ano do contrato: {contractYear}
          </span>
        </FormSection>

        <FormSection
          step="2"
          title="Valor e cobrança"
          description="Informe o dinheiro entregue e a taxa combinada com o cliente."
          icon={<CircleDollarSign className="size-5" aria-hidden="true" />}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="amount">
                Valor entregue ao cliente (R$)
              </label>
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                autoComplete="off"
                className={fieldClass}
                {...form.register("amount")}
              />
              <FieldError message={form.formState.errors.amount?.message} />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="monthlyInterest">
                Juros por mês (%)
              </label>
              <input
                id="monthlyInterest"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                autoComplete="off"
                className={fieldClass}
                {...form.register("monthlyInterest")}
              />
              <FieldError message={form.formState.errors.monthlyInterest?.message} />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="installmentsCount">
                Quantidade de parcelas
              </label>
              <input
                id="installmentsCount"
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                step="1"
                autoComplete="off"
                className={fieldClass}
                {...form.register("installmentsCount")}
              />
              <FieldError message={form.formState.errors.installmentsCount?.message} />
            </div>
          </div>

          {hideFinancials ? null : (
            <div className="grid gap-2 sm:grid-cols-4">
              <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Cliente recebe
                </p>
                <p className="mt-1.5 font-semibold tabular-nums text-white">{formatCurrency(amount)}</p>
              </article>
              <article className="rounded-2xl border border-[#d1a04f]/18 bg-[#d1a04f]/[0.06] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#bda66f]">
                  Juros do contrato
                </p>
                <p className="mt-1.5 font-semibold tabular-nums text-[#f0cf87]">
                  {formatCurrency(credit.totalInterest)}
                </p>
              </article>
              <article className="rounded-2xl border border-[#6f8790]/25 bg-[#27383a]/55 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#aebfbb]">
                  Total a receber
                </p>
                <p className="mt-1.5 font-semibold tabular-nums text-[#e2ece9]">
                  {formatCurrency(credit.totalReceivable)}
                </p>
              </article>
              <article className="rounded-2xl border border-[#6b9d6f]/25 bg-[#243528]/55 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#bfe3c2]">
                  Parcela prevista
                </p>
                <p className="mt-1.5 font-semibold tabular-nums text-[#dbe6d4]">
                  {formatCurrency(credit.installmentAmount)}
                </p>
              </article>
            </div>
          )}
        </FormSection>

        <FormSection
          step="3"
          title="Situação do empréstimo"
          description="Registre como o dinheiro foi entregue e em que etapa está a cobrança."
          icon={<ShieldCheck className="size-5" aria-hidden="true" />}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="paymentMethod">
                Forma de entrega do dinheiro
              </label>
              <select id="paymentMethod" className={selectClass} {...form.register("paymentMethod")}>
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO">Cartão</option>
                <option value="ABERTO">Não informado / em aberto</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="status">
                Situação atual
              </label>
              <select id="status" className={selectClass} {...form.register("status")}>
                <option value="DRAFT">Rascunho</option>
                <option value="OPEN">Aguardando assinatura</option>
                <option value="ACTIVE">Em cobrança</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="expenseAmount">
              Despesa desta operação (R$)
            </label>
            <input
              id="expenseAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoComplete="off"
              className={fieldClass}
              {...form.register("expenseAmount")}
            />
            <p className="text-xs leading-5 text-slate-500">
              Exemplo: transporte, cartório ou outra despesa para fazer este empréstimo.
            </p>
            <FieldError message={form.formState.errors.expenseAmount?.message} />
          </div>

          <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0f0e]/72 px-4 py-3 active:bg-white/[0.05]">
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-[#d1a04f]"
              {...form.register("guaranteeEnabled")}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-100">Empréstimo possui garantia</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                Marque quando houver bem, documento ou outro item garantindo o pagamento.
              </span>
            </span>
          </label>
        </FormSection>

        <FormSection
          step="4"
          title="Contrato e observações"
          description="Anexe a via assinada ou guarde o link do documento."
          icon={<FileSignature className="size-5" aria-hidden="true" />}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="signatureLink">
                Link da assinatura no gov.br
              </label>
              <input
                id="signatureLink"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://…"
                className={fieldClass}
                {...form.register("signatureLink")}
              />
              <FieldError message={form.formState.errors.signatureLink?.message} />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="signatureFile">
                Contrato assinado
              </label>
              {/* O servidor valida o limite do arquivo; PDF e imagem atendem
                  tanto a assinatura digital quanto a foto feita em campo. */}
              <input
                id="signatureFile"
                type="file"
                accept=".pdf,image/*"
                className={fieldClass}
                {...form.register("signatureFile")}
              />
              <p className="text-xs leading-5 text-slate-500">PDF ou foto do contrato assinado.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="notes">
              Observações do acordo
            </label>
            <textarea
              id="notes"
              placeholder="Ex.: vencimento combinado, descrição da garantia ou condição especial…"
              className={textareaClass}
              {...form.register("notes")}
            />
          </div>
        </FormSection>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-base font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.28)] transition-colors active:bg-[#e0b45f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f1cd86] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f0e] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
          {loading ? "Salvando empréstimo…" : "Salvar empréstimo"}
          {loading ? null : <ArrowRight className="size-5" aria-hidden="true" />}
        </button>
      </form>

      {saveError ? (
        <div
          className="rounded-2xl border border-[#9d6b50]/35 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]"
          aria-live="polite"
        >
          {saveError}
        </div>
      ) : null}

      {receipt ? (
        <article
          className={
            saveError
              ? "rounded-[28px] border border-[#b46c5d]/35 bg-[#2b1e19]/72 p-5"
              : "rounded-[28px] border border-[#8aa17c]/25 bg-[#243528]/72 p-5"
          }
        >
          {/* Nao dizer "salvo" quando nao salvou: em campo o cartao verde e
              lido de relance e o contrato se perde sem ninguem notar. */}
          <div className={saveError ? "flex items-center gap-2 text-[#f0c9ad]" : "flex items-center gap-2 text-[#dbe6d4]"}>
            <ReceiptText className="size-4" aria-hidden="true" />
            <p className="font-medium">
              {saveError ? "NÃO salvo no servidor — confira a conexão" : "Contrato salvo"}
            </p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Código: {receipt.clientCode}</p>
            <p>Cliente: {receipt.clientName}</p>
            {hideFinancials ? null : (
              <>
                <p>Valor: {formatCurrency(receipt.amount)}</p>
                <p>Juros do contrato: {formatCurrency(receipt.totalInterest)}</p>
                <p>Total a receber: {formatCurrency(receipt.totalReceivable)}</p>
                <p>{receipt.installmentsCount} parcela(s) de {formatCurrency(receipt.installmentAmount)}</p>
              </>
            )}
            <p>Data: {formatShortDate(receipt.contractDate)}</p>
            <p>Primeiro vencimento: {formatShortDate(receipt.dueDate)}</p>
            {hideFinancials ? null : <p>Despesa: {formatCurrency(receipt.expenseAmount)}</p>}
            <p>Pagamento: {rotuloDeStatus(receipt.paymentMethod, PAYMENT_METHOD_LABEL)}</p>
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
              ...(hideFinancials
                ? []
                : [
                    `*Valor entregue: ${formatCurrency(receipt.amount)}*`,
                    `Juros do contrato: ${formatCurrency(receipt.totalInterest)}`,
                    `Total a receber: ${formatCurrency(receipt.totalReceivable)}`,
                    `${receipt.installmentsCount} parcela(s) de ${formatCurrency(receipt.installmentAmount)}`,
                    `Despesa: ${formatCurrency(receipt.expenseAmount)}`,
                  ]),
              `Pagamento: ${rotuloDeStatus(receipt.paymentMethod, PAYMENT_METHOD_LABEL)}`,
              `Primeiro vencimento: ${formatShortDate(receipt.dueDate)}`,
              ...(receipt.signatureLink ? [`Assinatura: ${receipt.signatureLink}`] : []),
            ].join("\n")}
          />
        </article>
      ) : null}
    </div>
  );
}
