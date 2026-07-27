"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CalendarDays, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { getClientPrefillDataAction } from "@/server/actions/module-record-actions";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";
import { WhatsAppReceiptButton } from "./whatsapp-receipt-button";

const schema = z.object({
  clientName: z.string().min(2, "Informe o cliente."),
  phone: z.string().min(8, "Informe o telefone."),
  localName: z.string().min(2, "Informe o local."),
  document: z.string().optional(),
  eventDate: z.string().min(1, "Informe a data."),
  totalAmount: z.coerce.number().min(0, "Informe o valor."),
  signalEnabled: z.boolean().default(true),
  signalPercentage: z.coerce.number().min(0).max(100).default(30),
  expenseAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(["PIX", "DINHEIRO", "CARTAO", "ABERTO"]),
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]),
  contractNumber: z.string().optional(),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type ReceiptState = {
  clientName: string;
  phone: string;
  localName: string;
  eventDate: string;
  totalAmount: number;
  signalAmount: number;
  expenseAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  paymentStatus: string;
};

type LoadedRentalClient = { clientName: string; phone: string; localName: string; document: string };

export function RentalForm({ hideFinancials = false, initialClientName = "", initialPhone = "", initialClientId }: { hideFinancials?: boolean; initialClientName?: string; initialPhone?: string; initialClientId?: string } = {}) {
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadedClient, setLoadedClient] = useState<LoadedRentalClient | null>(null);
  const [clientLoading, setClientLoading] = useState(Boolean(initialClientId));

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: initialClientName,
      phone: initialPhone,
      signalEnabled: true,
      signalPercentage: 30,
      expenseAmount: 0,
      paymentMethod: "PIX",
      paymentStatus: "PENDING",
      totalAmount: 0,
    },
  });

  useEffect(() => {
    if (!initialClientId) return;
    getClientPrefillDataAction("locacao", initialClientId)
      .then((data) => {
        if (!data || data.kind !== "rental-order") return;
        setLoadedClient({ clientName: data.clientName, phone: data.phone, localName: data.localName, document: data.document });
        form.setValue("clientName", data.clientName);
        form.setValue("phone", data.phone);
        form.setValue("localName", data.localName);
        form.setValue("document", data.document);
      })
      .catch(() => setSaveError("Erro ao carregar dados do cliente."))
      .finally(() => setClientLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClientId]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setSaveError(null);

    const signalAmount = values.signalEnabled
      ? values.totalAmount * (values.signalPercentage / 100)
      : 0;

    try {
      const response = await fetch("/api/modules/locacao/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: values.clientName,
          phone: values.phone,
          localName: values.localName,
          document: values.document,
          eventDate: values.eventDate,
          totalAmount: Number(values.totalAmount),
          signalEnabled: values.signalEnabled,
          signalPercentage: Number(values.signalPercentage),
          expenseAmount: Number(values.expenseAmount),
          paymentMethod: values.paymentMethod,
          paymentStatus: values.paymentStatus,
          contractNumber: values.contractNumber,
          notes: values.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar a locacao.");
      }
    } catch {
      setSaveError("Registro mantido na tela. O salvamento no servidor falhou.");
    }

    setReceipt({
      clientName: values.clientName,
      phone: values.phone,
      localName: values.localName,
      eventDate: values.eventDate,
      totalAmount: values.totalAmount,
      signalAmount,
      expenseAmount: Number(values.expenseAmount),
      balanceAmount: values.totalAmount - signalAmount - Number(values.expenseAmount),
      paymentMethod: values.paymentMethod,
      paymentStatus: values.paymentStatus,
    });

    setLoading(false);

    submittingRef.current = false;
  });

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
        {clientLoading ? (
          <p className="text-sm text-slate-400">Carregando dados do cliente...</p>
        ) : loadedClient ? (
          <div className="rounded-[18px] border border-[#8aa17c]/30 bg-[#1e2e24]/60 p-4 text-sm text-[#dbe6d4] space-y-0.5">
            <p className="font-semibold text-white">{loadedClient.clientName}</p>
            <p className="text-[#9a958b]">{loadedClient.phone}</p>
            <p className="mt-1 text-xs text-[#9a958b]">{loadedClient.localName}{loadedClient.document ? ` · Doc: ${loadedClient.document}` : ""}</p>
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
              <input id="phone" className={fieldClass} {...form.register("phone")} />
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="localName">
                Local
              </label>
              <input id="localName" className={fieldClass} {...form.register("localName")} />
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="document">
                Documento
              </label>
              <input id="document" className={fieldClass} {...form.register("document")} />
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="eventDate">
              Data da locação
            </label>
            <input id="eventDate" type="date" className={fieldClass} {...form.register("eventDate")} />
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="totalAmount">
              Valor total
            </label>
            <input id="totalAmount" type="number" inputMode="decimal" step="0.01" className={fieldClass} {...form.register("totalAmount")} />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" {...form.register("signalEnabled")} />
            Usar sinal
          </label>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="signalPercentage">
              Sinal (%)
            </label>
            <input id="signalPercentage" type="number" className={fieldClass} {...form.register("signalPercentage")} />
            <p className={hintClass}>Sugestão do panorama: 30% opcional.</p>
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="paymentStatus">
              Status
            </label>
            <select id="paymentStatus" className={selectClass} {...form.register("paymentStatus")}>
              <option value="PENDING">Pendente</option>
              <option value="PARTIAL">Parcial</option>
              <option value="PAID">Pago</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="contractNumber">
              Contrato / reserva
            </label>
            <input id="contractNumber" className={fieldClass} {...form.register("contractNumber")} />
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="expenseAmount">
              Despesa
            </label>
            <input id="expenseAmount" type="number" inputMode="decimal" step="0.01" min="0" className={fieldClass} {...form.register("expenseAmount")} />
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
            Pendências / observações
          </label>
          <textarea id="notes" className={textareaClass} {...form.register("notes")} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3.5 text-sm font-semibold text-[#0d0a05] shadow-[0_6px_20px_rgba(209,160,79,0.32)] transition hover:bg-[#daa855] disabled:opacity-70"
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Registrar locação
          <ArrowRight className="size-4" />
        </button>
      </form>

      {saveError ? (
        <div className="rounded-2xl border border-[#9d6b50]/35 bg-[#2b1e19]/70 p-3 text-sm text-[#f0c9ad]">
          {saveError}
        </div>
      ) : null}

      {receipt ? (
        <article className="rounded-2xl border border-[#8aa17c]/25 bg-[#243528]/72 p-4">
          <div className="flex items-center gap-2 text-[#dbe6d4]">
            <CalendarDays className="size-4" />
            <h3 className="font-semibold">{receipt.clientName}</h3>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-[#dbe6d4] sm:grid-cols-2">
            <span>{receipt.localName}</span>
            <span>{formatShortDate(receipt.eventDate)}</span>
            {hideFinancials ? null : (
              <>
                <span>Total: {formatCurrency(receipt.totalAmount)}</span>
                <span>Sinal: {formatCurrency(receipt.signalAmount)}</span>
                <span>Despesa: {formatCurrency(receipt.expenseAmount)}</span>
                <span>Saldo: {formatCurrency(receipt.balanceAmount)}</span>
              </>
            )}
            <span>Pagamento: {receipt.paymentMethod}</span>
            <span>Status: {receipt.paymentStatus}</span>
          </div>
          <WhatsAppReceiptButton
            autoOpen
            defaultPhone={receipt.phone}
            message={[
              "*Comprovante Locação*",
              `Cliente: ${receipt.clientName}`,
              `Local: ${receipt.localName}`,
              `Data: ${formatShortDate(receipt.eventDate)}`,
              `*Total: ${formatCurrency(receipt.totalAmount)}*`,
              `Sinal: ${formatCurrency(receipt.signalAmount)}`,
              `Despesa: ${formatCurrency(receipt.expenseAmount)}`,
              `Saldo: ${formatCurrency(receipt.balanceAmount)}`,
              `Pagamento: ${receipt.paymentMethod}`,
              `Status: ${receipt.paymentStatus}`,
            ].join("\n")}
          />
        </article>
      ) : null}
    </div>
  );
}
