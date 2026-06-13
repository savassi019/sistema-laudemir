import { Plus, Search } from "lucide-react";

import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { listClients } from "@/server/services/client-service";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireSession("CLIENTS");
  const clients = await listClients();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(56,189,248,0.12))] p-5 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Cadastro e historico
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Clientes centralizados para todo o ecossistema.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              O mesmo cadastro alimenta financeiro, locacao, bilhar, pelucias, BX,
              contratos e historico consolidado por cliente.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white sm:w-auto">
              <Search className="size-4" />
              Buscar cliente
            </button>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 sm:w-auto">
              <Plus className="size-4" />
              Novo cliente
            </button>
          </div>
        </div>
      </section>

      <SectionCard
        title="Base de clientes"
        subtitle="Lista inicial preparada para receber filtros, historico, anexos, saldo e timeline por cliente."
      >
        <div className="grid gap-4 lg:hidden">
          {clients.map((client) => (
            <article
              key={client.id}
              className="rounded-[24px] border border-white/8 bg-slate-950/55 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {client.code}
                  </p>
                  <p className="text-base font-semibold text-white">{client.name}</p>
                  <p className="text-sm text-slate-400">{client.phone}</p>
                </div>
                <StatusBadge label={client.status} />
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Cidade</span>
                  <span>{client.city}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Saldo</span>
                  <span>{formatCurrency(client.balance)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Atualizado</span>
                  <span>{formatShortDate(client.updatedAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-[24px] border border-white/8 lg:block">
          <table className="min-w-full divide-y divide-white/8">
            <thead className="bg-slate-950/70">
              <tr className="text-left text-xs uppercase tracking-[0.22em] text-slate-500">
                <th className="px-5 py-4 font-medium">Codigo</th>
                <th className="px-5 py-4 font-medium">Cliente</th>
                <th className="px-5 py-4 font-medium">Cidade</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Saldo</th>
                <th className="px-5 py-4 font-medium">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 bg-slate-950/35">
              {clients.map((client) => (
                <tr key={client.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-5 py-4 text-sm font-medium text-white">
                    {client.code}
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">{client.name}</p>
                      <p className="text-sm text-slate-400">{client.phone}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-300">{client.city}</td>
                  <td className="px-5 py-4">
                    <StatusBadge label={client.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-200">
                    {formatCurrency(client.balance)}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-400">
                    {formatShortDate(client.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
