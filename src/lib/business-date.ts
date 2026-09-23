const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

export function currentBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${value.year}-${value.month}-${value.day}`;
}

export function currentBusinessDayRange(now = new Date()) {
  const date = currentBusinessDate(now);
  return {
    from: new Date(`${date}T00:00:00-03:00`),
    to: new Date(`${date}T23:59:59.999-03:00`),
  };
}
