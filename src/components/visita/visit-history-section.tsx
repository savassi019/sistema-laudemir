"use client";

import {
  ClipboardCheck,
  Pencil,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";

import { fieldClass, labelClass, selectClass, textareaClass } from "@/components/modules/styles";
import { formatCurrency } from "@/lib/format";
import { deleteVisitAction, updateVisitAction } from "@/server/actions/visit-actions";
import type { VisitRecord } from "@/types/app";

const VISIT_TYPES = [
  { value: "Bilhar / Pebolim", label: "Bilhar / Pebolim" },
  { value: "Pelúcia / Grua", label: "Pelúcia / Grua" },
  { value: "BX", label: "BX" },
  { value: "H (Caça-níquel)", label: "H (Caça-níquel)" },
  { value: "Carreta Kids", label: "Carreta Kids" },
  { value: "Locação", label: "Locação" },
  { value: "Geral", label: "Geral" },
];

export function VisitHistorySection({ initialVisits }: { initialVisits: VisitRecord[] }) {
  const [visits, setVisits] = useState(initialVisits);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(id: string) {
    setEditingId(id);
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleUpdate(visitId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const data = {
      visitType: String(fd.get("visitType") ?? "Geral"),
      occurredAt: String(fd.get("occurredAt") ?? ""),
      incomeAmount: Number(fd.get("incomeAmount") ?? 0),
      expenseAmount: Number(fd.get("expenseAmount") ?? 0),
      notes: String(fd.get("notes") ?? "").trim() || undefined,
    };

    startTransition(async () => {
      const updated = await updateVisitAction(visitId, data);
      if (updated) {
        setVisits((prev) => prev.map((v) => (v.id === visitId ? updated : v)));
      }
      setEditingId(null);
    });
  }

  function handleDelete(visitId: string) {
    startTransition(async () => {
      const ok = await deleteVisitAction(visitId);
      if (ok) {
        setVisits((prev) => prev.filter((v) => v.id !== visitId));
      }
      setConfirmDeleteId(null);
    });
  }

  return (
    <div className="mb-4">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardCheck className="size-4 text-[#d1a04f]" />
        <h2 className="text-base font-semibold text-white">Histórico de visitas</h2>
        <span className="ml-auto text-xs text-[#9a958b]">
          {visits.length} registro{visits.length !== 1 ? "s" : ""}
        </span>
      </div>

      {visits.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#5a544c]">Nenhuma visita registrada ainda.</p>
      ) : (
        <div className="space-y-3">
          {visits.map((v) =>
            editingId === v.id ? (
              <form
                key={v.id}
                onSubmit={(e) => handleUpdate(v.id, e)}
                className="overflow-hidden rounded-xl border border-[#d1a04f]/25 bg-[#111614]/88 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">Editar visita</p>
                  <button type="button" onClick={cancelEdit}>
                    <X className="size-4 text-[#9a958b]" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className={labelClass}>Tipo</span>
                    <select name="visitType" className={selectClass} defaultValue={v.visitType}>
                      {VISIT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>Data e hora</span>
                    <input
                      name="occurredAt"
                      type="datetime-local"
                      className={fieldClass}
                      defaultValue={v.occurredAt.slice(0, 16)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>Entrada (R$)</span>
                    <input name="incomeAmount" type="number" step="0.01" min="0" defaultValue={v.incomeAmount} className={fieldClass} />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>Saída (R$)</span>
                    <input name="expenseAmount" type="number" step="0.01" min="0" defaultValue={v.expenseAmount} className={fieldClass} />
                  </label>
                  <label className="block space-y-1 sm:col-span-2">
                    <span className={labelClass}>Observações</span>
                    <textarea name="notes" className={textareaClass} defaultValue={v.notes ?? ""} />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d1a04f] py-2.5 text-sm font-semibold text-[#0d0a05] disabled:opacity-60"
                >
                  {isPending ? "Salvando..." : "Salvar alterações"}
                </button>
              </form>
            ) : (
              <article
                key={v.id}
                className="overflow-hidden rounded-xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/55"
              >
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{v.visitType}</p>
                    <p className="text-xs text-[#9a958b]">
                      {v.occurredAt.slice(0, 16).replace("T", " às ")}
                    </p>
                    {v.createdBy ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-[#5a544c]">
                        <User className="size-3" />
                        {v.createdBy}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <p className="text-sm font-medium text-[#8aa17c]">+{formatCurrency(v.incomeAmount)}</p>
                    {v.expenseAmount > 0 ? (
                      <p className="text-xs text-[#9a958b]">-{formatCurrency(v.expenseAmount)}</p>
                    ) : null}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(v.id)}
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-[#9a958b] transition hover:text-white"
                        title="Editar"
                      >
                        <Pencil className="size-3" />
                      </button>
                      {confirmDeleteId === v.id ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDelete(v.id)}
                          className="rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-2 py-1 text-[11px] font-medium text-[#f87171] disabled:opacity-60"
                        >
                          Confirmar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(v.id)}
                          className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-[#9a958b] transition hover:text-[#f87171]"
                          title="Excluir"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {v.notes ? (
                  <p className="border-t border-[rgba(245,241,232,0.06)] px-4 py-2 text-xs text-[#9a958b]">
                    {v.notes}
                  </p>
                ) : null}
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}
