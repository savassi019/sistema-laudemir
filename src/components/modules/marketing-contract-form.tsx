"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText, Megaphone } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";

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
    digitalSignature: z.boolean().default(false),
    status: z.enum(["DRAFT", "PENDING", "ACTIVE", "CLOSED"]),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.personType === "PF" && !data.cpf) {
      ctx.addIssue({ code: "custom", path: ["cpf"], message: "CPF obrigatorio para PF." });
    }

    if (data.personType === "PJ" && !data.cnpj) {
      ctx.addIssue({ code: "custom", path: ["cnpj"], message: "CNPJ obrigatorio para PJ." });
    }
  });

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  name: string;
  personType: string;
  serviceType: string;
  contractValue: number;
  contractDate: string;
  status: string;
  signature: boolean;
  notes?: string;
};

export function MarketingContractForm() {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      personType: "PF",
      digitalSignature: false,
      status: "DRAFT",
      contractValue: 0,
    },
  });

  const digitalSignature = Boolean(
    useWatch({ control: form.control, name: "digitalSignature" }) ?? false,
  );
  const personType = String(
    useWatch({ control: form.control, name: "personType" }) ?? "PF",
  ) as "PF" | "PJ";
  const contractValue = Number(useWatch({ control: form.control, name: "contractValue" }) ?? 0);
  const signatureDiscount = useMemo(() => (digitalSignature ? 0.05 : 0), [digitalSignature]);
  const totalPreview = contractValue - contractValue * signatureDiscount;

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    setReceipt({
      name: values.name,
      personType: values.personType,
      serviceType: values.serviceType,
      contractValue,
      contractDate: values.contractDate,
      status: values.status,
      signature: values.digitalSignature,
      notes: values.notes,
    });

    setLoading(false);
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-violet-400/20 bg-violet-400/[0.08] p-4 text-sm leading-6 text-violet-50">
        <p className="font-medium">Marketing</p>
        <p>Cadastro rapido de contrato, pessoa fisica ou juridica, assinatura e valor.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Valor</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(contractValue)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Com assinatura</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(totalPreview)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Modelo</p>
          <p className="mt-2 text-xl font-semibold text-white">{personType}</p>
        </article>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
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
              <option value="PF">Pessoa fisica</option>
              <option value="PJ">Pessoa juridica</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="cpf">
              CPF
            </label>
            <input id="cpf" className={fieldClass} {...form.register("cpf")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="cnpj">
              CNPJ
            </label>
            <input id="cnpj" className={fieldClass} {...form.register("cnpj")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass} htmlFor="serviceType">
              Tipo de servico
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
            <input id="phone" className={fieldClass} {...form.register("phone")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="email">
              Email
            </label>
            <input id="email" className={fieldClass} {...form.register("email")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className={labelClass} htmlFor="address">
              Endereco
            </label>
            <input id="address" className={fieldClass} {...form.register("address")} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("digitalSignature")} />
            Assinatura digital
          </label>
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
            Observacoes
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

          <div className="rounded-[24px] border border-sky-400/20 bg-sky-400/[0.08] p-4">
          <div className="flex items-center gap-2 text-sky-100">
            <Megaphone className="size-4" />
            <p className="font-medium">Resumo do fechamento</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-sky-100/80">
            {digitalSignature
              ? "Assinatura digital habilitada."
              : "Assinatura digital ainda desligada."}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar contrato
          <ArrowRight className="size-4" />
        </button>
      </form>

      {receipt ? (
        <article className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/[0.08] p-5">
          <div className="flex items-center gap-2 text-emerald-100">
            <ReceiptText className="size-4" />
            <p className="font-medium">Contrato salvo na base demo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-emerald-50/85 md:grid-cols-2">
            <p>Nome: {receipt.name}</p>
            <p>Tipo: {receipt.personType}</p>
            <p>Servico: {receipt.serviceType}</p>
            <p>Valor: {formatCurrency(receipt.contractValue)}</p>
            <p>Data: {formatShortDate(receipt.contractDate)}</p>
            <p>Status: {receipt.status}</p>
          </div>
          {receipt.notes ? <p className="mt-3 text-sm text-emerald-50/75">{receipt.notes}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
