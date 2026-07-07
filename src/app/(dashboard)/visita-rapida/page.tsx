import { ClipboardCheck } from "lucide-react";

import { QuickVisitForm } from "@/components/visita/quick-visit-form";
import { requireSession } from "@/lib/auth";
import { listClients } from "@/server/services/client-service";

export const dynamic = "force-dynamic";

export default async function VisitaRapidaPage(props: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await requireSession();
  const clients = await listClients(session);
  const initialClientId = searchParams.clientId;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[linear-gradient(135deg,rgba(17,22,20,0.92),rgba(80,111,96,0.12))] p-4 md:p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-[#9a958b]">
          Campo
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Visita rápida
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#c9c2b4]">
          Checklist, fotos, valores e comprovante no WhatsApp do cliente — tudo
          em uma tela, sem navegação extra.
        </p>
      </section>

      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.2)] md:p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-[#d1a04f]/24 bg-[#d1a04f]/10 text-[#f3dfae]">
            <ClipboardCheck className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Registrar visita</p>
            <p className="text-xs text-[#9a958b]">
              O comprovante é gerado automaticamente ao salvar.
            </p>
          </div>
        </div>
        <QuickVisitForm clients={clients} initialClientId={initialClientId} />
      </section>
    </div>
  );
}
