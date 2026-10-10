import { ArrowLeft, ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { currentBusinessDate } from "@/lib/business-date";
import { moduleCatalog } from "@/lib/module-catalog";
import { listAuditTrail } from "@/server/services/audit-service";

export const dynamic = "force-dynamic";

const auditModules = [
  { value: "CORE", label: "Sistema" },
  { value: "SETTINGS", label: "Configurações" },
  { value: "CLIENTS", label: "Clientes" },
  { value: "FINANCE", label: "Financeiro" },
  ...moduleCatalog
    .filter((item) => item.group !== "core")
    .map((item) => ({ value: item.module, label: item.title })),
].filter((item, index, all) => all.findIndex((other) => other.value === item.value) === index);

function validDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function pageLink(
  filters: { from?: string; to?: string; module?: string; user?: string },
  page: number,
) {
  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.module) query.set("module", filters.module);
  if (filters.user) query.set("user", filters.user);
  query.set("page", String(page));
  return `/painel/auditoria?${query.toString()}`;
}

export default async function AuditoriaPage(props: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    module?: string;
    user?: string;
    page?: string;
  }>;
}) {
  const session = await requireSession("DASHBOARD");
  if (session.role !== "OWNER") redirect("/dashboard");

  const params = await props.searchParams;
  const today = currentBusinessDate();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const filters = {
    from: validDate(params.from) ?? currentBusinessDate(thirtyDaysAgo),
    to: validDate(params.to) ?? today,
    module: params.module || undefined,
    user: params.user?.trim() || undefined,
  };
  const trail = await listAuditTrail(session, {
    ...filters,
    page: Number(params.page) || 1,
  });

  return (
    <div className="space-y-4">
      <header className="flex items-start gap-3 rounded-2xl border border-[#d1a04f]/20 bg-[linear-gradient(135deg,rgba(17,22,20,0.96),rgba(209,160,79,0.08))] p-4 md:p-5">
        <Link
          href="/painel"
          aria-label="Voltar ao painel do dono"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#c9c2b4] active:scale-95"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d1a04f]">Controle do dono</p>
          <h1 className="mt-1 text-xl font-bold text-white md:text-2xl">Histórico de auditoria</h1>
          <p className="mt-1 text-sm text-[#9a958b]">Quem fez, quando fez e qual registro foi alterado.</p>
        </div>
        <History className="mt-2 size-5 shrink-0 text-[#f3dfae]" />
      </header>

      <form method="GET" action="/painel/auditoria" className="rounded-2xl border border-white/10 bg-[#111614]/82 p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5 text-sm text-[#c9c2b4]">
            <span>De</span>
            <input name="from" type="date" defaultValue={filters.from} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0b0f0e] px-3 text-base text-white" />
          </label>
          <label className="space-y-1.5 text-sm text-[#c9c2b4]">
            <span>Até</span>
            <input name="to" type="date" defaultValue={filters.to} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0b0f0e] px-3 text-base text-white" />
          </label>
          <label className="space-y-1.5 text-sm text-[#c9c2b4]">
            <span>Módulo</span>
            <select name="module" defaultValue={filters.module ?? ""} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0b0f0e] px-3 text-base text-white">
              <option value="">Todos</option>
              {auditModules.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm text-[#c9c2b4]">
            <span>Usuário</span>
            <input name="user" defaultValue={filters.user ?? ""} autoComplete="off" placeholder="Nome do usuário" className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0b0f0e] px-3 text-base text-white placeholder:text-[#5f5a52]" />
          </label>
        </div>
        <button className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d1a04f] px-4 text-sm font-bold text-black active:scale-[0.99] md:w-auto">
          <Search className="size-4" />
          Filtrar histórico
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f0e]/45">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <h2 className="text-base font-semibold text-white">Alterações encontradas</h2>
          <span className="text-xs text-[#9a958b]">{trail.total}</span>
        </div>
        {trail.rows.length === 0 ? (
          <p className="p-5 text-sm text-[#9a958b]">Nenhuma alteração encontrada nesse período.</p>
        ) : (
          <div className="divide-y divide-white/[0.07]">
            {trail.rows.map((item) => (
              <article key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white">{item.action}</h3>
                    <p className="mt-1 text-xs text-[#c9c2b4]">{item.module} · {item.user}</p>
                  </div>
                  <time dateTime={item.createdAt} className="shrink-0 text-right text-[11px] leading-4 text-[#7e786d]">
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(item.createdAt))}
                  </time>
                </div>
                <p className="mt-2 text-sm leading-5 text-[#9a958b]">{item.details}</p>
                <p className="mt-2 break-all text-[10px] text-[#5f5a52]">Registro: {item.entityId}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <nav aria-label="Paginação da auditoria" className="flex items-center justify-between gap-3">
        {trail.page > 1 ? (
          <Link href={pageLink(filters, trail.page - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-[#c9c2b4] active:bg-white/[0.05]">
            <ChevronLeft className="size-4" /> Anterior
          </Link>
        ) : <span />}
        <span className="text-xs text-[#9a958b]">Página {trail.page} de {trail.totalPages}</span>
        {trail.page < trail.totalPages ? (
          <Link href={pageLink(filters, trail.page + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-[#c9c2b4] active:bg-white/[0.05]">
            Próxima <ChevronRight className="size-4" />
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}
