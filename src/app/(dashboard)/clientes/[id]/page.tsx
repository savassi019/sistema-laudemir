import { AlertTriangle, ArrowLeft, ClipboardCheck, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientFinanceSection } from "@/components/clients/client-finance-section";
import { StatusBadge } from "@/components/ui/status-badge";
import { VisitHistorySection } from "@/components/visita/visit-history-section";
import { requireSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { listClients } from "@/server/services/client-service";
import { getClientVisits } from "@/server/services/visit-service";
import { getFinanceOverview } from "@/server/services/finance-service";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession("CLIENTS");
  const [clients, finance] = await Promise.all([
    listClients(session),
    getFinanceOverview(session),
  ]);

  const client = clients.find((c) => c.id === id);
  if (!client) notFound();

  const visits = await getClientVisits(session, id);

  const clientEntries = finance.entries.filter(
    (e) => e.customer === client.name,
  );

  const unpaidEntries = clientEntries.filter(
    (e) => e.status === "pendente" || e.status === "atrasado",
  );
  const partialEntries = clientEntries.filter((e) => e.status === "parcial");
  const debtEntries = [...unpaidEntries, ...partialEntries];
  const totalDebtAmount = debtEntries.reduce((sum, e) => sum + e.remaining, 0);
  const hasNotPaid = unpaidEntries.length > 0;
  const hasPartialPayment = partialEntries.length > 0;
  const hasDebtAccumulation = debtEntries.length >= 2;

  const statusLabel = {
    ativo: "ativo",
    inativo: "inativo",
    inadimplente: "inadimplente",
    excecao: "excecao",
  } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(245,241,232,0.1)] bg-white/[0.04] px-3 py-2 text-sm text-[#c9c2b4] transition hover:bg-white/[0.07]"
        >
          <ArrowLeft className="size-4" />
          Clientes
        </Link>
      </div>

      {/* Header */}
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#9a958b]">
              {client.code}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              {client.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-[#9a958b]">
              {client.phone !== "-" ? (
                <a
                  href={`tel:${client.phone.replace(/\D/g, "")}`}
                  className="flex items-center gap-1.5 transition hover:text-[#f3dfae]"
                >
                  <Phone className="size-3.5" />
                  {client.phone}
                </a>
              ) : null}
              {client.city !== "-" ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {client.city}
                  {client.state ? `, ${client.state}` : ""}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge label={statusLabel[client.status]} />
            {client.balance > 0 ? (
              <span className="rounded-lg bg-[#f87171]/10 px-2.5 py-1 text-xs font-medium text-[#f87171]">
                Saldo: {formatCurrency(client.balance)}
              </span>
            ) : null}
            <Link
              href={`/visita-rapida?clientId=${client.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#8aa17c]/35 bg-[#8aa17c]/12 px-3 py-2 text-xs font-semibold text-[#dbe6d4] transition hover:bg-[#8aa17c]/22"
            >
              <ClipboardCheck className="size-3.5" />
              Registrar visita
            </Link>
          </div>
        </div>
      </section>

      {/* Delinquency alerts */}
      {hasNotPaid || hasPartialPayment || hasDebtAccumulation ? (
        <section className="rounded-2xl border border-[#f87171]/25 bg-[#1a0f0f]/55 p-3 md:p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#f87171]" />
            <h2 className="text-sm font-semibold text-[#f0c9ad]">Alertas de cobrança</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasNotPaid ? (
              <span className="rounded-lg bg-[#f87171]/12 px-2.5 py-1.5 text-xs font-medium text-[#f87171]">
                Não pagou · {unpaidEntries.length}{" "}
                {unpaidEntries.length === 1 ? "lançamento" : "lançamentos"}
              </span>
            ) : null}
            {hasPartialPayment ? (
              <span className="rounded-lg bg-[#d1a04f]/12 px-2.5 py-1.5 text-xs font-medium text-[#f3dfae]">
                Pagamento parcial · {partialEntries.length}{" "}
                {partialEntries.length === 1 ? "lançamento" : "lançamentos"}
              </span>
            ) : null}
            {hasDebtAccumulation ? (
              <span className="rounded-lg bg-[#f87171]/15 px-2.5 py-1.5 text-xs font-semibold text-[#f87171]">
                Acúmulo de dívidas · {formatCurrency(totalDebtAmount)} em {debtEntries.length}{" "}
                lançamentos
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Visit history */}
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-4 md:p-5">
        <VisitHistorySection initialVisits={visits} />
      </section>

      {/* Financial history */}
      <ClientFinanceSection
        clientId={client.id}
        clientName={client.name}
        initialEntries={clientEntries}
      />
    </div>
  );
}
