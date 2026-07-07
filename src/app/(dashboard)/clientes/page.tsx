import { ClientManagement } from "@/components/clients/client-management";
import { requireSession } from "@/lib/auth";
import { listClients } from "@/server/services/client-service";
import { listVisits } from "@/server/services/visit-service";
import { getFinanceOverview } from "@/server/services/finance-service";
import type { DelinquencyInfo } from "@/types/app";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await requireSession("CLIENTS");
  const [clients, visits, finance] = await Promise.all([
    listClients(session),
    listVisits(session, 2000),
    getFinanceOverview(session),
  ]);

  const lastVisitByClient: Record<string, { daysSinceVisit: number; lastVisitAt: string }> = {};
  const now = Date.now();
  for (const v of visits) {
    if (!v.clientId || lastVisitByClient[v.clientId]) continue;
    const days = Math.floor((now - new Date(v.occurredAt).getTime()) / 86_400_000);
    lastVisitByClient[v.clientId] = { daysSinceVisit: days, lastVisitAt: v.occurredAt };
  }

  const delinquencyByClient: Record<string, DelinquencyInfo> = {};
  for (const client of clients) {
    const entries = finance.entries.filter((e) => e.customer === client.name);
    const unpaidCount = entries.filter(
      (e) => e.status === "pendente" || e.status === "atrasado",
    ).length;
    const partialCount = entries.filter((e) => e.status === "parcial").length;
    const debtCount = unpaidCount + partialCount;
    const totalDebtAmount = entries
      .filter((e) => e.status !== "pago")
      .reduce((sum, e) => sum + e.remaining, 0);

    if (debtCount > 0) {
      delinquencyByClient[client.id] = {
        hasNotPaid: unpaidCount > 0,
        hasPartialPayment: partialCount > 0,
        hasDebtAccumulation: debtCount >= 2,
        totalDebtAmount,
      };
    }
  }

  return (
    <ClientManagement
      initialClients={clients}
      visitMap={lastVisitByClient}
      delinquencyMap={delinquencyByClient}
    />
  );
}
