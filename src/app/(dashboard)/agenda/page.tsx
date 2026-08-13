import { CalendarDays, ChevronRight, ClipboardCheck, MapPin, Plus, UserCheck } from "lucide-react";
import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { listVisitsInRange, getUnvisitedClients } from "@/server/services/visit-service";
import { listClients } from "@/server/services/client-service";

export const dynamic = "force-dynamic";

const PT_WEEK = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const PT_MONTH = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtDay(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${PT_WEEK[d.getDay()]}, ${d.getDate()} de ${PT_MONTH[d.getMonth()]}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function AgendaPage() {
  const session = await requireSession("DASHBOARD");

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

  const [visits, clients] = await Promise.all([
    listVisitsInRange(session, sevenDaysAgo, todayStr),
    listClients(session),
  ]);

  const unvisited = session.role !== "STAFF"
    ? await getUnvisitedClients(session, clients, 15)
    : [];

  // Group visits by date (descending)
  const byDate = visits.reduce<Record<string, typeof visits>>((acc, v) => {
    const day = v.occurredAt.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(v);
    return acc;
  }, {});

  const sortedDays = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  const isToday = (d: string) => d === todayStr;

  const totalToday = byDate[todayStr]?.length ?? 0;
  const totalWeek = visits.length;
  const incomeWeek = visits.reduce((s, v) => s + v.incomeAmount - v.expenseAmount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[linear-gradient(135deg,rgba(17,22,20,0.92),rgba(80,111,96,0.12))] p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#9a958b]">Campo</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Agenda de visitas
            </h1>
            <p className="mt-1 text-sm text-[#c9c2b4]">Últimos 7 dias · {totalWeek} visita{totalWeek !== 1 ? "s" : ""}</p>
          </div>
          <Link
            href="/visita-rapida"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#d1a04f] px-3 py-2.5 text-xs font-bold text-[#0d0a05] shadow-[0_4px_14px_rgba(209,160,79,0.35)] transition hover:bg-[#daa855]"
          >
            <Plus className="size-3.5" />
            Nova visita
          </Link>
        </div>

        {/* Week stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/[0.04] p-3 text-center">
            <CalendarDays className="mx-auto mb-1 size-4 text-[#8aa17c]" />
            <p className="text-lg font-bold text-white leading-none">{totalToday}</p>
            <p className="mt-0.5 text-[10px] text-[#9a958b]">hoje</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-3 text-center">
            <ClipboardCheck className="mx-auto mb-1 size-4 text-[#d1a04f]" />
            <p className="text-lg font-bold text-white leading-none">{totalWeek}</p>
            <p className="mt-0.5 text-[10px] text-[#9a958b]">na semana</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-3 text-center">
            <MapPin className="mx-auto mb-1 size-4 text-[#60a5fa]" />
            <p className="text-sm font-bold text-[#dbe6d4] leading-none">{formatCurrency(incomeWeek)}</p>
            <p className="mt-0.5 text-[10px] text-[#9a958b]">resultado</p>
          </div>
        </div>
      </section>

      {/* Clientes que precisam de visita */}
      {unvisited.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[#60a5fa]/20 bg-[#0a0f1a]">
          <div className="flex items-center gap-3 bg-[#60a5fa]/10 px-4 py-3.5">
            <MapPin className="size-4 text-[#60a5fa]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#60a5fa]">Precisam de visita</p>
              <p className="text-xs text-[#9a958b]">Sem registro há mais de 15 dias</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#60a5fa] px-2 py-0.5 text-xs font-bold text-white">
              {unvisited.length}
            </span>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {unvisited.slice(0, 5).map((c) => (
              <Link
                key={c.clientId}
                href={`/visita-rapida?clientId=${c.clientId}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
              >
                <div className="size-1.5 shrink-0 rounded-full bg-[#60a5fa]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{c.clientName}</p>
                  <p className="text-xs text-[#9a958b]">{c.clientCode}{c.city ? ` · ${c.city}` : ""}</p>
                </div>
                <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${c.daysSinceVisit >= 30 ? "bg-[#f87171]/12 text-[#f87171]" : "bg-[#60a5fa]/12 text-[#60a5fa]"}`}>
                  {c.daysSinceVisit >= 999 ? "Nunca" : `${c.daysSinceVisit}d`}
                </span>
              </Link>
            ))}
          </div>
          {unvisited.length > 5 && (
            <div className="border-t border-[rgba(255,255,255,0.04)] px-4 py-2.5">
              <Link href="/clientes" className="flex items-center gap-1 text-xs font-medium text-[#60a5fa]/70 transition hover:text-[#60a5fa]">
                Ver todos os {unvisited.length} <ChevronRight className="size-3" />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Visit timeline */}
      {sortedDays.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 p-8 text-center">
          <CalendarDays className="mx-auto mb-3 size-10 text-[#5a544c]" />
          <p className="text-sm font-semibold text-[#9a958b]">Nenhuma visita nos últimos 7 dias</p>
          <Link
            href="/visita-rapida"
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#d1a04f] px-4 py-3 text-sm font-bold text-[#0d0a05]"
          >
            <Plus className="size-4" />
            Registrar visita agora
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDays.map((day) => {
            const dayVisits = byDate[day];
            const today = isToday(day);
            return (
              <section key={day} className="overflow-hidden rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72">
                <div className={`flex items-center gap-3 px-4 py-3 ${today ? "bg-[#d1a04f]/10 border-b border-[#d1a04f]/20" : "border-b border-[rgba(245,241,232,0.06)]"}`}>
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${today ? "bg-[#d1a04f] text-[#0d0a05]" : "bg-white/[0.06] text-[#c9c2b4]"}`}>
                    {new Date(day + "T12:00:00").getDate()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${today ? "text-[#f3dfae]" : "text-white"}`}>
                      {today ? "Hoje" : fmtDay(day)}
                    </p>
                    <p className="text-xs text-[#9a958b]">{dayVisits.length} visita{dayVisits.length !== 1 ? "s" : ""}</p>
                  </div>
                  <span className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-bold ${today ? "bg-[#d1a04f]/20 text-[#f3dfae]" : "bg-white/[0.06] text-[#9a958b]"}`}>
                    {formatCurrency(dayVisits.reduce((s, v) => s + v.incomeAmount - v.expenseAmount, 0))}
                  </span>
                </div>
                <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {dayVisits.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#8aa17c]/15 text-[#8aa17c]">
                        <ClipboardCheck className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{v.clientName}</p>
                        <p className="text-xs text-[#9a958b]">
                          {v.visitType} · {fmtTime(v.occurredAt)}
                          {v.assignedToName
                            ? ` · ${v.assignedToName}`
                            : v.createdBy
                              ? ` · ${v.createdBy}`
                              : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-[#dbe6d4]">
                          {formatCurrency(v.incomeAmount)}
                        </p>
                        {v.expenseAmount > 0 && (
                          <p className="text-[10px] text-[#f87171]">-{formatCurrency(v.expenseAmount)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* CTA if there are visits */}
      {visits.length > 0 && (
        <Link
          href="/relatorio"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/72 py-3.5 text-sm font-semibold text-[#c9c2b4] transition hover:bg-white/[0.05]"
        >
          <UserCheck className="size-4" />
          Ver relatório completo
        </Link>
      )}
    </div>
  );
}
