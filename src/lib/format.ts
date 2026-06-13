import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatShortDate(value: string | Date) {
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
}

export function formatLongDate(value: string | Date) {
  return format(new Date(value), "dd 'de' MMMM", { locale: ptBR });
}
