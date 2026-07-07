"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, FileCheck2, Link2, LoaderCircle, Megaphone, ReceiptText } from "lucide-react";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/cn";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { maskCnpj, maskCpf, maskPhone, withMask } from "@/lib/masks";
import { isValidCnpj, isValidCpf } from "@/lib/validators";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const schema = z
  .object({
    name: z.string().min(2, "Informe o nome."),
    personType: z.enum(["PF", "PJ"]),
    cpf: z.string().optional(),
    cnpj: z.string().optional(),
    serviceType: z.string().min(2, "Informe o servico."),
    contractValue: z.coerce.number().min(0),
    contractDate: z.string().min(1, "Informe a data."),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email("Email invalido.").optional().or(z.literal("")),
    signatureLink: z.string().optional(),
    signatureFile: z.any().optional(),
    expenseAmount: z.coerce.number().min(0).default(0),
    paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
    contractFile: z.any().optional(),
    status: z.enum(["DRAFT", "PENDING", "ACTIVE", "CLOSED"]),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.personType === "PF" && !data.cpf) {
      ctx.addIssue({ code: "custom", path: ["cpf"], message: "CPF obrigatorio para PF." });
    } else if (data.cpf?.trim() && !isValidCpf(data.cpf)) {
      ctx.addIssue({ code: "custom", path: ["cpf"], message: "CPF invalido." });
    }

    if (data.personType === "PJ" && !data.cnpj) {
      ctx.addIssue({ code: "custom", path: ["cnpj"], message: "CNPJ obrigatorio para PJ." });
    } else if (data.cnpj?.trim() && !isValidCnpj(data.cnpj)) {
      ctx.addIssue({ code: "custom", path: ["cnpj"], message: "CNPJ invalido." });
    }
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  name: string;
  phone: string;
  personType: string;
  serviceType: string;
  contractValue: number;
  contractDate: string;
  expenseAmount: number;
  paymentMethod: string;
  contractFileName?: string;
  status: string;
  signatureLink?: string;
  signatureFileName?: string;
  notes?: string;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  CLOSED: "Fechado",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "border-white/10 bg-white/5 text-slate-400",
  PENDING: "border-[#c9a84c]/35 bg-[#c9a84c]/10 text-[#f0d98a]",
  ACTIVE: "border-[#6b9d6f]/35 bg-[#6b9d6f]/10 text-[#bfe3c2]",
  CLOSED: "border-[#7b6fc0]/35 bg-[#7b6fc0]/10 text-[#c8bef5]",
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
  if (!response.ok) return null;

  const result = (await response.json()) as { id: string };
  return result.id;
}

export function MarketingContractForm({
  hideFinancials = false,
}: { hideFinancials?: boolean } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      personType: "PF",
      expenseAmount: 0,
      paymentMethod: "PIX",
      status: "DRAFT",
      contractValue: 0,
    },
  });

  const personType = String(
    useWatch({ control: form.control, name: "personType" }) ?? "PF",
  ) as "PF" | "PJ";
  const contractValue = Number(useWatch({ control: form.control, name: "contractValue" }) ?? 0);
  const expenseAmount = Number(useWatch({ control: form.control, name: "expenseAmount" }) ?? 0);
  const signatureLinkValue = useWatch({ control: form.control, name: "signatureLink" });
  const statusValue = String(useWatch({ control: form.control, name: "status" }) ?? "DRAFT");
  const netValue = contractValue - expenseAmount;

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    const contractFile = getFile(values.contractFile);
    const contractFileId = contractFile ? await uploadFile(contractFile, "CONTRACT") : null;
    const signatureFile = getFile(values.signatureFile);
    const signatureFileId = signatureFile ? await uploadFile(signatureFile, "CONTRACT") : null;

    try {
      const response = await fetch("/api/modules/marketing/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          personType: values.personType,
          cpf: values.cpf,
          cnpj: values.cnpj,
          serviceType: values.serviceType,
          contractValue: Number(values.contractValue),
          contractDate: values.contractDate,
          address: values.address,
          phone: values.phone,
          email: values.email,
          signatureLink: values.signatureLink,
          signatureFileId,
          expenseAmount: Number(values.expenseAmount),
          paymentMethod: values.paymentMethod,
          contractFileId,
          status: values.status,
          notes: values.notes,
        }),
      });

      if (!response.ok) throw new Error("Falha ao salvar o contrato.");
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

    setReceipt({
      name: values.name,
      phone: values.phone ?? "",
      personType: values.personType,
      serviceType: values.serviceType,
      contractValue,
      contractDate: values.contractDate,
      expenseAmount: Number(values.expenseAmount),
      paymentMethod: values.paymentMethod,
      contractFileName: contractFile?.name,
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
      {/* Header */}
      <div className="flex items-center gap-3 rounded-[20px] border border-[#7b6fc0]/30 bg-[#1e1b35]/80 px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#7b6fc0]/20">
          <Megaphone className="size-4 text-[#c8bef5]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#c8bef5]">Marketing</p>
          <p className="text-xs text-[#c8bef5]/60">Contrato · PF ou PJ · Assinatura gov.br</p>
        </div>
        {!hideFinancials && contractValue > 0 ? (
          <p className="ml-auto text-base font-bold text-[#c8bef5]">{formatCurrency(contractValue)}</p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-5">

        {/* Seção: Contratante */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
            Contratante
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass} htmlFor="name">Nome completo</label>
              <input id="name" className={fieldClass} {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-xs text-[#d59a8b]">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="personType">Tipo</label>
              <select id="personType" className={selectClass} {...form.register("personType")}>
                <option value="PF">Pessoa física</option>
                <option value="PJ">Pessoa jurídica</option>
              </select>
            </div>

            {personType === "PF" ? (
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="cpf">CPF</label>
                <input
                  id="cpf"
                  className={fieldClass}
                  inputMode="numeric"
                  maxLength={14}
                  {...withMask(form.register("cpf"), maskCpf)}
                />
                {form.formState.errors.cpf ? (
                  <p className="text-xs text-[#d59a8b]">{form.formState.errors.cpf.message}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="cnpj">CNPJ</label>
                <input
                  id="cnpj"
                  className={fieldClass}
                  inputMode="numeric"
                  maxLength={18}
                  {...withMask(form.register("cnpj"), maskCnpj)}
                />
                {form.formState.errors.cnpj ? (
                  <p className="text-xs text-[#d59a8b]">{form.formState.errors.cnpj.message}</p>
                ) : null}
              </div>
            )}

            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="phone">Telefone</label>
              <input
                id="phone"
                className={fieldClass}
                inputMode="tel"
                maxLength={15}
                {...withMask(form.register("phone"), maskPhone)}
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="email">E-mail</label>
              <input id="email" className={fieldClass} inputMode="email" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-xs text-[#d59a8b]">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass} htmlFor="address">Endereço</label>
              <input id="address" className={fieldClass} {...form.register("address")} />
            </div>
          </div>
        </div>

        {/* Seção: Contrato */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
            Contrato
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass} htmlFor="serviceType">Tipo de serviço</label>
              <input id="serviceType" className={fieldClass} {...form.register("serviceType")} />
              {form.formState.errors.serviceType ? (
                <p className="text-xs text-[#d59a8b]">{form.formState.errors.serviceType.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="contractDate">Data</label>
              <input id="contractDate" type="date" className={fieldClass} {...form.register("contractDate")} />
              {form.formState.errors.contractDate ? (
                <p className="text-xs text-[#d59a8b]">{form.formState.errors.contractDate.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="status">Status</label>
              <select
                id="status"
                className={cn(selectClass, STATUS_COLOR[statusValue] ?? "")}
                {...form.register("status")}
              >
                <option value="DRAFT">Rascunho</option>
                <option value="PENDING">Pendente</option>
                <option value="ACTIVE">Ativo</option>
                <option value="CLOSED">Fechado</option>
              </select>
            </div>

            {!hideFinancials ? (
              <>
                <div className="space-y-1.5">
                  <label className={labelClass} htmlFor="contractValue">Valor do contrato</label>
                  <input
                    id="contractValue"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className={fieldClass}
                    {...form.register("contractValue")}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass} htmlFor="expenseAmount">Despesa</label>
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
              </>
            ) : null}

            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="paymentMethod">Pagamento</label>
              <select id="paymentMethod" className={selectClass} {...form.register("paymentMethod")}>
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO">Cartão</option>
                <option value="ABERTO">Aberto</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="contractFile">Anexar contrato</label>
              <input id="contractFile" type="file" className={fieldClass} {...form.register("contractFile")} />
            </div>
          </div>

          {!hideFinancials && contractValue > 0 ? (
            <div className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              netValue >= 0
                ? "border-[#6b9d6f]/35 bg-[#6b9d6f]/10 text-[#bfe3c2]"
                : "border-[#b46c5d]/40 bg-[#b46c5d]/10 text-[#f0a08f]",
            )}>
              Líquido: {formatCurrency(netValue)}
            </div>
          ) : null}
        </div>

        {/* Seção: Assinatura gov.br */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
              Assinatura gov.br
            </p>
            {signatureLinkValue ? (
              <span className="rounded-full border border-[#6b9d6f]/35 bg-[#6b9d6f]/10 px-2 py-0.5 text-[10px] font-semibold text-[#bfe3c2]">
                registrada
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                pendente
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass} htmlFor="signatureLink">
                <Link2 className="mr-1 inline size-3" />
                Link do documento assinado
              </label>
              <input
                id="signatureLink"
                className={fieldClass}
                placeholder="https://..."
                {...form.register("signatureLink")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass} htmlFor="signatureFile">
                <FileCheck2 className="mr-1 inline size-3" />
                PDF assinado (opcional)
              </label>
              <input id="signatureFile" type="file" accept=".pdf" className={fieldClass} {...form.register("signatureFile")} />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="notes">Observações</label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7b6fc0] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(123,111,192,0.35)] transition hover:bg-[#8a7fd4] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar contrato
          <ArrowRight className="size-4" />
        </button>
      </form>

      {saveError ? (
        <div className="rounded-2xl border border-[#9d6b50]/35 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]">
          {saveError}
        </div>
      ) : null}

      {receipt ? (
        <article className="rounded-[28px] border border-[#7b6fc0]/30 bg-[#1e1b35]/80 p-5">
          <div className="flex items-center gap-2 text-[#c8bef5]">
            <ReceiptText className="size-4" />
            <p className="font-medium">Contrato salvo</p>
            <span className={cn(
              "ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              STATUS_COLOR[receipt.status] ?? "",
            )}>
              {STATUS_LABEL[receipt.status] ?? receipt.status}
            </span>
          </div>
          <div className="mt-4 grid gap-2.5 text-sm text-[#c8bef5]/80 sm:grid-cols-2">
            <p>Nome: <span className="font-medium text-[#c8bef5]">{receipt.name}</span></p>
            <p>Tipo: {receipt.personType === "PF" ? "Pessoa física" : "Pessoa jurídica"}</p>
            <p>Serviço: {receipt.serviceType}</p>
            <p>Data: {formatShortDate(receipt.contractDate)}</p>
            {!hideFinancials ? (
              <>
                <p>Valor: <span className="font-semibold text-[#c8bef5]">{formatCurrency(receipt.contractValue)}</span></p>
                <p>Despesa: {formatCurrency(receipt.expenseAmount)}</p>
              </>
            ) : null}
            <p>Pagamento: {receipt.paymentMethod}</p>
            {receipt.contractFileName ? <p>Contrato: {receipt.contractFileName}</p> : null}
            {receipt.signatureLink ? (
              <p className="sm:col-span-2">
                Assinatura:{" "}
                <a
                  href={receipt.signatureLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-[#a89ee0] underline underline-offset-2"
                >
                  {receipt.signatureLink}
                </a>
              </p>
            ) : null}
            {receipt.signatureFileName ? <p>PDF: {receipt.signatureFileName}</p> : null}
          </div>
          {receipt.notes ? (
            <p className="mt-3 text-sm text-[#c8bef5]/60">{receipt.notes}</p>
          ) : null}
          <WhatsAppReceiptButton
            defaultPhone={receipt.phone}
            message={[
              "*Comprovante Marketing*",
              `Nome: ${receipt.name}`,
              `Serviço: ${receipt.serviceType}`,
              `*Valor: ${formatCurrency(receipt.contractValue)}*`,
              `Data: ${formatShortDate(receipt.contractDate)}`,
              `Status: ${STATUS_LABEL[receipt.status] ?? receipt.status}`,
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
