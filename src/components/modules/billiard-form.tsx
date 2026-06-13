"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, ReceiptText, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { fieldClass, labelClass, selectClass, textareaClass } from "./styles";

const schema = z.object({
  clientName: z.string().min(2, "Informe o cliente."),
  pointName: z.string().min(2, "Informe o ponto."),
  phone: z.string().min(8, "Informe um telefone valido."),
  city: z.string().min(2, "Informe a cidade."),
  neighborhood: z.string().min(2, "Informe o bairro."),
  state: z.string().min(2, "Informe o estado."),
  tableModel: z.string().min(2, "Informe o modelo da mesa."),
  chipValue: z.coerce.number().min(0),
  quantityOfChips: z.coerce.number().min(0),
  percentage: z.coerce.number().min(0).max(100),
  roofDebt: z.coerce.number().min(0),
  roofPaymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
  employeeCost: z.coerce.number().min(0),
  installationCost: z.coerce.number().min(0),
  maintenanceCost: z.coerce.number().min(0),
  otherCost: z.coerce.number().min(0),
  routeNumber: z.coerce.number().min(0),
  partialRoute: z.string().optional(),
  maintenanceDate: z.string().min(1, "Informe a data da manutencao."),
  notes: z.string().optional(),
  photo: z.any().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  clientName: string;
  pointName: string;
  tableModel: string;
  grossAmount: number;
  clientShare: number;
  companyShare: number;
  totalCosts: number;
  finalValue: number;
  quantityOfChips: number;
  maintenanceDate: string;
  photoName?: string;
  notes?: string;
};

export function BilliardForm() {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      percentage: 25,
      roofDebt: 0,
      roofPaymentMethod: "ABERTO",
      employeeCost: 0,
      installationCost: 0,
      maintenanceCost: 0,
      otherCost: 0,
      routeNumber: 1,
      chipValue: 0,
      quantityOfChips: 0,
    },
  });

  const quantityOfChips = Number(
    useWatch({ control: form.control, name: "quantityOfChips" }) ?? 0,
  );
  const chipValue = Number(useWatch({ control: form.control, name: "chipValue" }) ?? 0);
  const percentage = Number(useWatch({ control: form.control, name: "percentage" }) ?? 0);

  const grossAmount = useMemo(
    () => Number(quantityOfChips || 0) * Number(chipValue || 0),
    [quantityOfChips, chipValue],
  );
  const clientShare = useMemo(
    () => grossAmount * (Number(percentage || 0) / 100),
    [grossAmount, percentage],
  );
  const companyShare = grossAmount - clientShare;
  const employeeCost = Number(useWatch({ control: form.control, name: "employeeCost" }) ?? 0);
  const installationCost = Number(
    useWatch({ control: form.control, name: "installationCost" }) ?? 0,
  );
  const maintenanceCost = Number(
    useWatch({ control: form.control, name: "maintenanceCost" }) ?? 0,
  );
  const otherCost = Number(useWatch({ control: form.control, name: "otherCost" }) ?? 0);
  const roofDebt = Number(useWatch({ control: form.control, name: "roofDebt" }) ?? 0);
  const totalCosts = employeeCost + installationCost + maintenanceCost + otherCost + roofDebt;
  const finalValue = companyShare - totalCosts;

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const photo = values.photo?.[0] as File | undefined;

    setReceipt({
      clientName: values.clientName,
      pointName: values.pointName,
      tableModel: values.tableModel,
      grossAmount,
      clientShare,
      companyShare,
      totalCosts,
      finalValue,
      quantityOfChips: Number(values.quantityOfChips),
      maintenanceDate: values.maintenanceDate,
      photoName: photo?.name,
      notes: values.notes,
    });

    setLoading(false);
  });

  const clothWarning = Number(quantityOfChips || 0) >= 1500;

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/[0.08] p-4 text-sm leading-6 text-amber-50">
        <p className="font-medium">Regra de operacao</p>
        <p>Quando as fichas passarem de 1500, o sistema deve sinalizar troca de pano.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="clientName">
              Cliente
            </label>
            <input id="clientName" className={fieldClass} {...form.register("clientName")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="pointName">
              Nome do ponto
            </label>
            <input id="pointName" className={fieldClass} {...form.register("pointName")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="phone">
              Telefone
            </label>
            <input id="phone" className={fieldClass} {...form.register("phone")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="tableModel">
              Modelo da mesa
            </label>
            <input
              id="tableModel"
              className={fieldClass}
              {...form.register("tableModel")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="city">
              Cidade
            </label>
            <input id="city" className={fieldClass} {...form.register("city")} />
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
            <label className={labelClass} htmlFor="state">
              Estado
            </label>
            <input id="state" className={fieldClass} {...form.register("state")} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="routeNumber">
              Numero da rota
            </label>
            <input
              id="routeNumber"
              type="number"
              min="0"
              className={fieldClass}
              {...form.register("routeNumber")}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="chipValue">
              Valor da ficha
            </label>
            <input
              id="chipValue"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("chipValue")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="quantityOfChips">
              Quantidade de fichas
            </label>
            <input
              id="quantityOfChips"
              type="number"
              min="0"
              className={fieldClass}
              {...form.register("quantityOfChips")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="percentage">
              Porcentagem
            </label>
            <input
              id="percentage"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className={fieldClass}
              {...form.register("percentage")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="roofDebt">
              Telhado em aberto
            </label>
            <input
              id="roofDebt"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("roofDebt")}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="roofPaymentMethod">
              Pagamento do telhado
            </label>
            <select
              id="roofPaymentMethod"
              className={selectClass}
              {...form.register("roofPaymentMethod")}
            >
              <option value="ABERTO">Aberto</option>
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO">Cartao</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="maintenanceDate">
              Data de manutencao
            </label>
            <input
              id="maintenanceDate"
              type="date"
              className={fieldClass}
              {...form.register("maintenanceDate")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="employeeCost">
              Custo funcionario
            </label>
            <input
              id="employeeCost"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("employeeCost")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="installationCost">
              Instalacao
            </label>
            <input
              id="installationCost"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("installationCost")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="maintenanceCost">
              Manutencao
            </label>
            <input
              id="maintenanceCost"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("maintenanceCost")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="otherCost">
              Outros
            </label>
            <input
              id="otherCost"
              type="number"
              step="0.01"
              min="0"
              className={fieldClass}
              {...form.register("otherCost")}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="partialRoute">
              Rota parcial
            </label>
            <input
              id="partialRoute"
              className={fieldClass}
              {...form.register("partialRoute")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="photo">
            Anexo de 1 foto
          </label>
          <input id="photo" type="file" className={fieldClass} {...form.register("photo")} />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="notes">
            Observacoes
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        <div
          className={`rounded-[24px] border p-4 ${clothWarning ? "border-amber-400/20 bg-amber-400/[0.08]" : "border-sky-400/20 bg-sky-400/[0.08]"}`}
        >
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-amber-200" />
            <p className="font-medium text-white">
              {clothWarning ? "Troca de pano recomendada" : "Operacao normal"}
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/80">
            Bruto: {formatCurrency(grossAmount)} | Cliente: {formatCurrency(clientShare)} |
            Casa: {formatCurrency(companyShare)} | Custos: {formatCurrency(totalCosts)} |
            Final: {formatCurrency(finalValue)}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Salvar Bilhar / Pebolim
          <ArrowRight className="size-4" />
        </button>
      </form>

      {receipt ? (
        <article className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/[0.08] p-5">
          <div className="flex items-center gap-2 text-emerald-100">
            <ReceiptText className="size-4" />
            <p className="font-medium">Registro salvo na base demo</p>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-emerald-50/85 md:grid-cols-2">
            <p>Cliente: {receipt.clientName}</p>
            <p>Ponto: {receipt.pointName}</p>
            <p>Modelo: {receipt.tableModel}</p>
            <p>Fichas: {receipt.quantityOfChips}</p>
            <p>Bruto: {formatCurrency(receipt.grossAmount)}</p>
            <p>Final: {formatCurrency(receipt.finalValue)}</p>
            <p>Manutencao: {formatShortDate(receipt.maintenanceDate)}</p>
          </div>
          {receipt.photoName ? (
            <p className="mt-3 text-sm text-emerald-50/75">Foto: {receipt.photoName}</p>
          ) : null}
          {receipt.notes ? <p className="mt-3 text-sm text-emerald-50/75">{receipt.notes}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
