"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  FileText,
  Fuel,
  LoaderCircle,
  Plus,
  ReceiptText,
  RotateCcw,
  Send,
  Utensils,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useIdempotentSubmission } from "@/hooks/use-idempotent-submission";
import { cn } from "@/lib/cn";
import { currentBusinessDate } from "@/lib/business-date";
import { formatCurrency } from "@/lib/format";
import {
  OFFLINE_SUBMISSION_EVENT,
  postJsonWithOfflineQueue,
  readOfflineSubmissions,
} from "@/lib/offline-submission-queue";
import {
  EMPLOYEE_CASH_STATUS_LABEL,
  rotuloDeStatus,
} from "@/lib/status-labels";
import {
  cancelEmployeeExpenseAction,
  listEmployeeCashBoxesAction,
  reviewEmployeeCashAction,
  saveEmployeeCashAdvanceAction,
  submitEmployeeCashAction,
} from "@/server/actions/employee-cash-actions";
import type {
  EmployeeCashBoxItem,
  EmployeeExpenseItem,
} from "@/server/services/employee-cash-service";

import { PhotoCaptureInput } from "./photo-capture-input";
import { SaveStatusBanner, type SaveStatus } from "./save-status-banner";
import { fieldClass, hintClass, labelClass, selectClass, textareaClass } from "./styles";

const expenseSchema = z.object({
  category: z.enum(["MEAL", "FUEL", "TOLL", "OTHER"]),
  amount: z.coerce.number().min(0.01, "Informe o valor do gasto."),
  funding: z.enum(["COMPANY_ADVANCE", "EMPLOYEE_OWN", "COMPANY_DIRECT"]),
  paymentMethod: z.enum([
    "CASH",
    "PIX",
    "CREDIT_CARD",
    "DEBIT_CARD",
    "BANK_TRANSFER",
    "OTHER",
  ]),
  notes: z.string().max(1000).optional(),
  proof: z.any().refine((value) => Boolean(getFile(value)), "Tire a foto do comprovante."),
});

type ExpenseInput = z.input<typeof expenseSchema>;
type ExpenseValues = z.output<typeof expenseSchema>;

const STATUS_STYLE: Record<string, string> = {
  OPEN: "border-[#60a5fa]/25 bg-[#60a5fa]/8 text-[#bfdbfe]",
  SUBMITTED: "border-[#fbbf24]/30 bg-[#fbbf24]/8 text-[#fde68a]",
  APPROVED: "border-[#4ade80]/25 bg-[#4ade80]/8 text-[#bbf7d0]",
  RETURNED: "border-[#fb7185]/30 bg-[#fb7185]/8 text-[#fecdd3]",
};

const CATEGORY_ICON = {
  MEAL: Utensils,
  FUEL: Fuel,
  TOLL: ReceiptText,
  OTHER: FileText,
} as const;

function getFile(value: unknown) {
  const file = Array.isArray(value) ? value[0] : (value as FileList | undefined)?.[0];
  return file instanceof File ? file : undefined;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ExpenseRow({
  expense,
  canCancel,
  busy,
  onCancel,
}: {
  expense: EmployeeExpenseItem;
  canCancel: boolean;
  busy: boolean;
  onCancel: () => void;
}) {
  const Icon = CATEGORY_ICON[expense.category as keyof typeof CATEGORY_ICON] ?? FileText;
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        expense.cancelled
          ? "border-white/8 bg-white/[0.015] opacity-55"
          : "border-white/10 bg-white/[0.025]",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#d1a04f]/10 text-[#e0b872]">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{expense.categoryLabel}</p>
              <p className="mt-0.5 text-xs text-[#9a958b]">{expense.fundingLabel}</p>
            </div>
            <p className="shrink-0 text-sm font-bold tabular-nums text-[#f5d99d]">
              {formatCurrency(expense.amount)}
            </p>
          </div>
          <p className="mt-2 text-xs text-[#8e887e]">
            {expense.paymentMethodLabel} · {formatDateTime(expense.createdAt)}
          </p>
          {expense.notes ? <p className="mt-1 text-xs leading-5 text-[#c9c2b4]">{expense.notes}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {expense.proofFileId ? (
              <a
                href={`/api/files/${expense.proofFileId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-semibold text-[#e0b872] active:bg-white/[0.06]"
              >
                <ReceiptText className="size-3.5" />
                Comprovante
              </a>
            ) : null}
            {canCancel && !expense.cancelled ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#fb7185]/25 px-3 text-xs font-semibold text-[#fda4af] active:bg-[#fb7185]/10 disabled:opacity-50"
              >
                <XCircle className="size-3.5" />
                Cancelar
              </button>
            ) : null}
          </div>
          {expense.cancelled ? <p className="mt-2 text-xs font-semibold text-[#9a958b]">Lançamento cancelado</p> : null}
        </div>
      </div>
    </div>
  );
}

function OwnerCashCard({
  box,
  busy,
  onReview,
}: {
  box: EmployeeCashBoxItem;
  busy: boolean;
  onReview: (decision: "APPROVE" | "RETURN", notes: string) => void;
}) {
  const [notes, setNotes] = useState(box.reviewNotes ?? "");
  const totals = box.totals;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f0e]/55">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 p-4">
        <div>
          <p className="text-base font-bold text-white">{box.employeeName}</p>
          <p className="mt-1 text-xs text-[#9a958b]">{box.expenses.filter((item) => !item.cancelled).length} gasto(s) informado(s)</p>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_STYLE[box.status])}>
          {rotuloDeStatus(box.status, EMPLOYEE_CASH_STATUS_LABEL)}
        </span>
      </div>

      {totals ? (
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
          <ValueCard label="Entregue" value={box.advanceAmount} />
          <ValueCard label="Gastos" value={totals.totalExpense} />
          <ValueCard label="Devolver" value={totals.cashToReturn} tone="amber" />
          <ValueCard label="Reembolsar" value={totals.reimbursement} tone="rose" />
          <ValueCard label="Pago direto" value={totals.companyDirect} />
          <ValueCard label="Dinheiro próprio" value={totals.employeePaid} />
        </div>
      ) : null}

      <div className="space-y-2 px-3 pb-3">
        {box.expenses.length > 0 ? (
          box.expenses.map((expense) => (
            <ExpenseRow key={expense.id} expense={expense} canCancel={false} busy={busy} onCancel={() => {}} />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-[#8e887e]">Nenhum gasto lançado.</p>
        )}
      </div>

      {box.employeeNotes ? (
        <p className="mx-3 mb-3 rounded-xl bg-white/[0.025] p-3 text-xs leading-5 text-[#c9c2b4]">
          <span className="font-semibold text-white">Observação:</span> {box.employeeNotes}
        </p>
      ) : null}
      {box.reviewNotes ? (
        <p className="mx-3 mb-3 rounded-xl border border-[#fb7185]/20 bg-[#fb7185]/6 p-3 text-xs leading-5 text-[#fecdd3]">
          <span className="font-semibold">Revisão:</span> {box.reviewNotes}
        </p>
      ) : null}

      {box.status === "SUBMITTED" ? (
        <div className="space-y-2 border-t border-white/8 p-3">
          <label className="space-y-1.5">
            <span className={labelClass}>Motivo, caso precise devolver</span>
            <textarea
              className={textareaClass}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Explique o que precisa ser corrigido"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onReview("RETURN", notes)}
              disabled={busy || notes.trim().length < 3}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#fb7185]/30 text-sm font-semibold text-[#fda4af] active:bg-[#fb7185]/10 disabled:opacity-40"
            >
              <RotateCcw className="size-4" />
              Corrigir
            </button>
            <button
              type="button"
              onClick={() => onReview("APPROVE", notes)}
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#4ade80] text-sm font-bold text-[#07120a] active:scale-[0.98] disabled:opacity-50"
            >
              <CheckCircle2 className="size-4" />
              Aprovar
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ValueCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "rose";
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8e887e]">{label}</p>
      <p className={cn(
        "mt-1 text-sm font-bold tabular-nums",
        tone === "amber" ? "text-[#fde68a]" : tone === "rose" ? "text-[#fda4af]" : "text-white",
      )}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

export function EmployeeDailyCashPanel({
  slug,
  canReview = false,
}: {
  slug: string;
  canReview?: boolean;
}) {
  const [businessDate, setBusinessDate] = useState(() => currentBusinessDate());
  const [boxes, setBoxes] = useState<EmployeeCashBoxItem[]>([]);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [employeeNotes, setEmployeeNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasQueuedExpense, setHasQueuedExpense] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);
  const submission = useIdempotentSubmission();
  const form = useForm<ExpenseInput, unknown, ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: "MEAL",
      amount: 0,
      funding: "COMPANY_ADVANCE",
      paymentMethod: "CASH",
      notes: "",
    },
  });

  const ownBox = boxes.find((box) => box.isOwn) ?? null;
  const editable = !ownBox || ownBox.status === "OPEN" || ownBox.status === "RETURNED";

  async function refresh(date = businessDate) {
    setLoading(true);
    setError(null);
    try {
      const next = await listEmployeeCashBoxesAction(slug, date);
      setBoxes(next);
      const own = next.find((box) => box.isOwn);
      if (!canReview) {
        setAdvanceAmount(own?.advanceAmount ?? 0);
        setEmployeeNotes(own?.employeeNotes ?? "");
      }
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível carregar os gastos."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(businessDate);
    // A troca de modulo/data e o gatilho intencional para recarregar o caixa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessDate, slug]);

  useEffect(() => {
    const endpoint = `/api/employee-cash/${slug}/expenses`;
    const checkQueue = async () => {
      try {
        const items = await readOfflineSubmissions();
        setHasQueuedExpense(items.some((item) => item.endpoint === endpoint));
      } catch {
        // Se a leitura local falhar depois de um envio offline, mantemos o
        // bloqueio atual para nunca fechar o dia descartando um gasto pendente.
      }
    };
    // A fila vive fora do React, no IndexedDB. O evento mantém o botão de
    // fechamento bloqueado até todos os gastos deste módulo sincronizarem.
    void checkQueue();
    const handleQueueChange = () => void checkQueue();
    window.addEventListener(OFFLINE_SUBMISSION_EVENT, handleQueueChange);
    return () => window.removeEventListener(OFFLINE_SUBMISSION_EVENT, handleQueueChange);
  }, [slug]);

  async function saveAdvance() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await saveEmployeeCashAdvanceAction(slug, {
        businessDate,
        advanceAmount,
        employeeNotes,
      });
      setBoxes([result]);
      setSuccess("Valor recebido e observação salvos.");
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível salvar o caixa."));
    } finally {
      setBusy(false);
    }
  }

  const saveExpense = form.handleSubmit(async (values) => {
    const proof = getFile(values.proof);
    if (!proof) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    setSaveStatus("saving");
    try {
      const result = await postJsonWithOfflineQueue<{ expense: EmployeeExpenseItem }>({
        endpoint: `/api/employee-cash/${slug}/expenses`,
        payload: {
          businessDate,
          advanceAmount,
          employeeNotes,
          category: values.category,
          amount: values.amount,
          funding: values.funding,
          paymentMethod: values.paymentMethod,
          notes: values.notes,
          proofFileId: "",
        },
        requestKey: submission.key(),
        label: `Gasto de ${values.category.toLowerCase()}`,
        files: [{ file: proof, category: "PROOF", payloadPath: "proofFileId" }],
      });
      submission.complete();
      form.reset({
        category: "MEAL",
        amount: 0,
        funding: "COMPANY_ADVANCE",
        paymentMethod: "CASH",
        notes: "",
      });
      setPhotoKey((current) => current + 1);
      if (result.queued) {
        setHasQueuedExpense(true);
        setSaveStatus("queued");
        setSuccess("Gasto protegido no aparelho e aguardando internet.");
      } else {
        setSaveStatus("saved");
        setSuccess("Gasto registrado com comprovante.");
        await refresh();
      }
    } catch (caught) {
      setSaveStatus("error");
      setError(errorMessage(caught, "Não foi possível salvar o gasto."));
    } finally {
      setBusy(false);
    }
  });

  async function cancelExpense(expenseId: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await cancelEmployeeExpenseAction(slug, expenseId);
      setBoxes([result]);
      setSuccess("Gasto cancelado sem apagar o histórico.");
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível cancelar o gasto."));
    } finally {
      setBusy(false);
    }
  }

  async function submitDay() {
    if (!ownBox) return;
    if (hasQueuedExpense) {
      setError("Aguarde a sincronização dos gastos protegidos antes de fechar o dia.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await submitEmployeeCashAction(slug, ownBox.id);
      setBoxes([result]);
      setSuccess("Gastos enviados para conferência do dono.");
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível enviar o caixa."));
    } finally {
      setBusy(false);
    }
  }

  async function review(cashId: string, decision: "APPROVE" | "RETURN", notes: string) {
    setBusy(true);
    setError(null);
    try {
      await reviewEmployeeCashAction(slug, cashId, { decision, notes });
      setSuccess(decision === "APPROVE" ? "Gastos aprovados." : "Caixa devolvido para correção.");
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível revisar o caixa."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-3 overflow-x-hidden">
      <div className="rounded-2xl border border-white/10 bg-[#0b0f0e]/55 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#d1a04f]/12 text-[#e0b872]">
            <Banknote className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white">
              {canReview ? "Conferência dos gastos" : "Meus gastos do dia"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#9a958b]">
              {canReview
                ? "Confira os comprovantes e aprove ou devolva para correção."
                : "Registre cada gasto com o comprovante antes de fechar o dia."}
            </p>
          </div>
        </div>
        <label className="mt-4 block space-y-1.5">
          <span className={labelClass}>Dia do trabalho</span>
          <input
            type="date"
            max={currentBusinessDate()}
            value={businessDate}
            onChange={(event) => setBusinessDate(event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      {error ? <p role="alert" className="rounded-2xl border border-[#fb7185]/30 bg-[#2b1519]/80 p-3 text-sm text-[#fecdd3]">{error}</p> : null}
      {success ? <p role="status" className="rounded-2xl border border-[#4ade80]/25 bg-[#0e1c10]/80 p-3 text-sm text-[#bbf7d0]">{success}</p> : null}
      <SaveStatusBanner status={saveStatus} />

      {loading ? (
        <div className="flex min-h-32 items-center justify-center rounded-2xl border border-white/10 bg-[#0b0f0e]/45 text-sm text-[#9a958b]">
          <LoaderCircle className="mr-2 size-4 animate-spin" />
          Carregando gastos...
        </div>
      ) : canReview ? (
        boxes.length > 0 ? (
          <div className="space-y-3">
            {boxes.map((box) => (
              <OwnerCashCard
                key={box.id}
                box={box}
                busy={busy}
                onReview={(decision, notes) => review(box.id, decision, notes)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-6 text-center">
            <Clock3 className="mx-auto size-6 text-[#6f6a61]" />
            <p className="mt-2 text-sm font-semibold text-[#c9c2b4]">Nenhum funcionário lançou gastos neste dia.</p>
          </div>
        )
      ) : (
        <>
          <section className="rounded-2xl border border-white/10 bg-[#0b0f0e]/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white">Dinheiro recebido da empresa</h4>
                <p className="mt-1 text-xs text-[#9a958b]">Informe quanto recebeu para os gastos deste dia.</p>
              </div>
              {ownBox ? (
                <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_STYLE[ownBox.status])}>
                  {rotuloDeStatus(ownBox.status, EMPLOYEE_CASH_STATUS_LABEL)}
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className={labelClass}>Valor recebido (R$)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={advanceAmount}
                  onChange={(event) => setAdvanceAmount(Number(event.target.value))}
                  disabled={!editable}
                  className={fieldClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className={labelClass}>Observação do dia</span>
                <input
                  value={employeeNotes}
                  onChange={(event) => setEmployeeNotes(event.target.value)}
                  disabled={!editable}
                  placeholder="Opcional"
                  className={fieldClass}
                />
              </label>
            </div>
            {editable ? (
              <button
                type="button"
                onClick={saveAdvance}
                disabled={busy}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#d1a04f]/30 bg-[#d1a04f]/8 text-sm font-semibold text-[#f3dfae] active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                Salvar valor recebido
              </button>
            ) : null}
            {ownBox?.reviewNotes ? (
              <p className="mt-3 rounded-xl border border-[#fb7185]/20 bg-[#fb7185]/6 p-3 text-xs leading-5 text-[#fecdd3]">
                <span className="font-semibold">Correção solicitada:</span> {ownBox.reviewNotes}
              </p>
            ) : null}
          </section>

          {editable ? (
            <form onSubmit={saveExpense} className="rounded-2xl border border-white/10 bg-[#0b0f0e]/55 p-4">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-[#e0b872]" />
                <h4 className="text-sm font-bold text-white">Adicionar gasto</h4>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className={labelClass}>Tipo do gasto</span>
                  <select className={selectClass} {...form.register("category")}>
                    <option value="MEAL">Alimentação</option>
                    <option value="FUEL">Combustível</option>
                    <option value="TOLL">Pedágio</option>
                    <option value="OTHER">Outros gastos</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className={labelClass}>Valor gasto (R$)</span>
                  <input type="number" min="0.01" step="0.01" inputMode="decimal" className={fieldClass} {...form.register("amount")} />
                  {form.formState.errors.amount ? <span className="text-xs text-[#fda4af]">{form.formState.errors.amount.message}</span> : null}
                </label>
                <label className="space-y-1.5">
                  <span className={labelClass}>Esse gasto foi pago com</span>
                  <select className={selectClass} {...form.register("funding")}>
                    <option value="COMPANY_ADVANCE">Dinheiro entregue pela empresa</option>
                    <option value="EMPLOYEE_OWN">Dinheiro do funcionário</option>
                    <option value="COMPANY_DIRECT">Pago diretamente pela empresa</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className={labelClass}>Forma de pagamento</span>
                  <select className={selectClass} {...form.register("paymentMethod")}>
                    <option value="CASH">Dinheiro</option>
                    <option value="PIX">PIX</option>
                    <option value="CREDIT_CARD">Cartão de crédito</option>
                    <option value="DEBIT_CARD">Cartão de débito</option>
                    <option value="BANK_TRANSFER">Transferência</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className={labelClass}>Observação</span>
                  <textarea className={textareaClass} placeholder="Ex.: almoço durante a rota" {...form.register("notes")} />
                </label>
                <div className="sm:col-span-2">
                  <PhotoCaptureInput
                    key={photoKey}
                    registration={form.register("proof")}
                    label="Foto do comprovante"
                    hint="Obrigatória para salvar o gasto"
                    required
                  />
                  {form.formState.errors.proof ? <p className="mt-1 text-xs text-[#fda4af]">{String(form.formState.errors.proof.message)}</p> : null}
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d1a04f] text-sm font-bold text-[#17130b] active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Salvar gasto
              </button>
            </form>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-[#0b0f0e]/55 p-4">
            <h4 className="text-sm font-bold text-white">Lançamentos informados</h4>
            <p className={cn("mt-1", hintClass)}>Você vê os valores que informou; os totais gerais ficam somente com o dono.</p>
            <div className="mt-3 space-y-2">
              {ownBox?.expenses.length ? (
                ownBox.expenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    canCancel={editable}
                    busy={busy}
                    onCancel={() => cancelExpense(expense.id)}
                  />
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-[#8e887e]">Nenhum gasto registrado neste dia.</p>
              )}
            </div>
          </section>

          {ownBox && editable ? (
            <div className="space-y-2">
              {hasQueuedExpense ? (
                <p className="rounded-xl border border-[#fbbf24]/30 bg-[#2a2110]/70 p-3 text-xs leading-5 text-[#fde68a]">
                  Há gasto aguardando sincronização. Envie a fila protegida antes de fechar o dia.
                </p>
              ) : null}
              <button
                type="button"
                onClick={submitDay}
                disabled={busy || hasQueuedExpense}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#4ade80] text-sm font-bold text-[#07120a] active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                Fechar gastos e enviar ao dono
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
