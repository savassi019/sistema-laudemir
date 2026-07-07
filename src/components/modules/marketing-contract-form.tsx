"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText, Megaphone } from "lucide-react";
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
  const signatureLinkValue = useWatch({ control: form.control, name: "signatureLink" });

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

      if (!response.ok) {
        throw new Error("Falha ao salvar o contrato.");
      }
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
      <div className="rounded-[24px] border border-[#9b7b70]/25 bg-[#372b28]/70 p-4 text-sm leading-6 text-[#ead0c7]">
        <p className="font-medium">Marketing</p>
        <p>Cadastro rápido de contrato, pessoa física ou jurídica, assinatura e valor.</p>
      </div>

      <div className={cn("grid gap-3", hideFinancials ? "sm:grid-cols-1" : "sm:grid-cols-2")}>
        {hideFinancials ? null : (
          <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Valor</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(contractValue)}</p>
          </article>
        )}
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Modelo</p>
          <p className="mt-2 text-xl font-semibold text-white">{personType}</p>
        </article>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a958b]">
              Cadastro de cliente
            </p>
            <label className={labelClass} htmlFor="name">
              Nome
            </label>
            <input id="name" className={fieldClass} {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="personType">
              Tipo de pessoa
            </label>
            <select id="personType" className={selectClass} {...form.register("personType")}>
              <option value="PF">Pessoa física</option>
              <option value="PJ">Pessoa jurídica</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="cpf">
              CPF
            </label>
            <input
              id="cpf"
              className={fieldClass}
              maxLength={14}
              {...withMask(form.register("cpf"), maskCpf)}
            />
            {form.formState.errors.cpf ? (
              <p className="text-[12px] text-[#d59a8b]">{form.formState.errors.cpf.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="cnpj">
              CNPJ
            </label>
            <input
              id="cnpj"
              className={fieldClass}
              maxLength={18}
              {...withMask(form.register("cnpj"), maskCnpj)}
            />
            {form.formState.errors.cnpj ? (
              <p className="text-[12px] text-[#d59a8b]">{form.formState.errors.cnpj.message}</p>
            ) : null}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass} htmlFor="serviceType">
              Tipo de serviço
            </label>
            <input id="serviceType" className={fieldClass} {...form.register("serviceType")} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="contractValue">
              Valor do contrato
            </label>
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
            <label className={labelClass} htmlFor="phone">
              Telefone
            </label>
            <input
              id="phone"
              className={fieldClass}
              maxLength={15}
              {...withMask(form.register("phone"), maskPhone)}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="email">
              Email
            </label>
            <input id="email" className={fieldClass} {...form.register("email")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass} htmlFor="address">
              Endereço
            </label>
            <input id="address" className={fieldClass} {...form.register("address")} />
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
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass} htmlFor="contractFile">
              Anexar contrato
            </label>
            <input id="contractFile" type="file" className={fieldClass} {...form.register("contractFile")} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
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
          <div className="space-y-2">
            <label className={labelClass} htmlFor="status">
              Status
            </label>
            <select id="status" className={selectClass} {...form.register("status")}>
              <option value="DRAFT">Rascunho</option>
              <option value="PENDING">Pendente</option>
              <option value="ACTIVE">Ativo</option>
              <option value="CLOSED">Fechado</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="notes">
            Observações
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

          <div className="rounded-[24px] border border-[#6f8790]/25 bg-[#27383a]/70 p-4">
          <div className="flex items-center gap-2 text-[#d6e1de]">
            <Megaphone className="size-4" />
            <p className="font-medium">Resumo do fechamento</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#d6e1de]/80">
            {signatureLinkValue
              ? "Assinatura via gov.br registrada (link)."
              : "Assinatura via gov.br ainda pendente."}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
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
        <article className="rounded-[28px] border border-[#8aa17c]/25 bg-[#243528]/72 p-5">
          <div className="flex items-center gap-2 text-[#dbe6d4]">
            <ReceiptText className="size-4" />
            <p className="font-medium">Contrato salvo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#dbe6d4]/85 md:grid-cols-2">
            <p>Nome: {receipt.name}</p>
            <p>Tipo: {receipt.personType}</p>
            <p>Serviço: {receipt.serviceType}</p>
            {hideFinancials ? null : <p>Valor: {formatCurrency(receipt.contractValue)}</p>}
            <p>Data: {formatShortDate(receipt.contractDate)}</p>
            <p>Status: {receipt.status}</p>
            {hideFinancials ? null : <p>Despesa: {formatCurrency(receipt.expenseAmount)}</p>}
            <p>Pagamento: {receipt.paymentMethod}</p>
            {receipt.contractFileName ? <p>Anexo contrato: {receipt.contractFileName}</p> : null}
            {receipt.signatureLink ? <p>Assinatura: {receipt.signatureLink}</p> : null}
            {receipt.signatureFileName ? <p>PDF assinado: {receipt.signatureFileName}</p> : null}
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-[#dbe6d4]/75">{receipt.notes}</p> : null}
          <WhatsAppReceiptButton
            defaultPhone={receipt.phone}
            message={[
              "*Comprovante Marketing*",
              `Nome: ${receipt.name}`,
              `Serviço: ${receipt.serviceType}`,
              `*Valor: ${formatCurrency(receipt.contractValue)}*`,
              `Data: ${formatShortDate(receipt.contractDate)}`,
              `Status: ${receipt.status}`,
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
