import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function toLocalDate(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!dateOnlyMatch) {
    return new Date(value);
  }

  const [, year, month, day] = dateOnlyMatch;
  return new Date(Number(year), Number(month) - 1, Number(day), 12);
}

export function formatShortDate(value: string | Date) {
  return format(toLocalDate(value), "dd/MM/yyyy", { locale: ptBR });
}

export function formatLongDate(value: string | Date) {
  return format(toLocalDate(value), "dd 'de' MMMM", { locale: ptBR });
}
