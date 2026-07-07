import { Camera, FileText, WalletCards } from "lucide-react";

import { formatCurrency, formatShortDate } from "@/lib/format";
import type { BilliardPointHistoryEntry } from "@/server/services/billiard-route-service";
import { hintClass } from "./styles";

export const ROOF_PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  ABERTO: "Aberto",
};

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export function BilliardPointHistoryList({
  entries,
  hideFinancials = false,
}: {
  entries: BilliardPointHistoryEntry[];
  hideFinancials?: boolean;
}) {
  if (entries.length === 0) {
    return <p className={hintClass}>Nenhum registro ainda para este ponto.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((item) =>
        item.type === "collection" ? (
          <div key={`collection-${item.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                <WalletCards className="size-3.5 text-[#d1a04f]" />
                {formatShortDate(item.date)}
              </p>
              <p className="text-xs text-[#9a958b]">{item.quantityOfChips} fichas</p>
            </div>
            {!hideFinancials ? (
              <div className="mt-1.5 grid grid-cols-2 gap-1 text-xs text-[#9a958b] sm:grid-cols-4">
                <span>Bruto: {formatCurrency(item.grossAmount)}</span>
                <span>Percentual cliente: {item.percentage}%</span>
                <span>Desconto: {formatCurrency(item.discountAmount)}</span>
                <span>Telhado: {formatCurrency(item.roofAmount)}</span>
                <span>Func.: {formatCurrency(item.employeeCost)}</span>
                <span>Instalação: {formatCurrency(item.installationCost)}</span>
                <span>Manutenção: {formatCurrency(item.maintenanceCost)}</span>
                <span>Outros: {formatCurrency(item.otherCost)}</span>
                {item.roofPaymentMethod ? (
                  <span>Pagto telhado: {ROOF_PAYMENT_LABELS[item.roofPaymentMethod] ?? item.roofPaymentMethod}</span>
                ) : null}
                <span className="font-medium text-[#dbe6d4]">
                  Resultado: {formatCurrency(item.finalValue)}
                </span>
              </div>
            ) : null}
            {item.photos.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={`/api/files/${photo.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-[#9a958b] hover:text-white"
                  >
                    <Camera className="size-3" />
                    {photo.name}
                  </a>
                ))}
              </div>
            ) : null}
            {item.createdByName ? (
              <p className="mt-1.5 text-[11px] text-[#5a544c]">Registrado por {item.createdByName}</p>
            ) : null}
          </div>
        ) : (
          <div key={`maintenance-${item.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                <FileText className="size-3.5 text-[#9d6b50]" />
                {formatShortDate(item.date)}
              </p>
              <span className="text-xs text-[#9a958b]">
                {MAINTENANCE_STATUS_LABELS[item.status] ?? item.status}
              </span>
            </div>
            {item.materials ? <p className="mt-1.5 text-xs text-[#9a958b]">Materiais: {item.materials}</p> : null}
            {item.notes ? <p className="mt-1 text-xs text-[#9a958b]">{item.notes}</p> : null}
            {item.createdByName ? (
              <p className="mt-1.5 text-[11px] text-[#5a544c]">Registrado por {item.createdByName}</p>
            ) : null}
          </div>
        ),
      )}
    </div>
  );
}
