export function buildMapsLink(parts: {
  street?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string | null {
  const address = [parts.street, parts.neighborhood, parts.city, parts.state]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");

  if (!address) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
