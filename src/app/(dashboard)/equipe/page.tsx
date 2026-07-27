import { Activity, Users } from "lucide-react";

import { ContactPhonesSettings } from "@/components/equipe/contact-phones-settings";
import { StaffManagement } from "@/components/equipe/staff-management";
import { requireSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getContactPhones } from "@/server/services/settings-service";
import { listStaff } from "@/server/services/user-service";
import { listVisits } from "@/server/services/visit-service";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    return (
      <div className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-8 text-center text-sm text-[#9a958b]">
        Sem permissão para acessar esta página.
      </div>
    );
  }

  const [staff, visits, contactPhones] = await Promise.all([
    listStaff(session),
    listVisits(session, 2000),
    getContactPhones(session),
  ]);

  const staffVisitStats: Record<string, { count: number; lastVisitAt?: string }> = {};
  for (const v of visits) {
    if (!v.createdBy) continue;
    const key = v.createdBy;
    if (!staffVisitStats[key]) staffVisitStats[key] = { count: 0 };
    staffVisitStats[key].count++;
    if (!staffVisitStats[key].lastVisitAt) {
      staffVisitStats[key].lastVisitAt = v.occurredAt;
    }
  }

  // Atividade dos últimos 7 dias por funcionário
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const recentVisits = visits.filter((v) => new Date(v.occurredAt) >= sevenDaysAgo);

  type StaffWeekActivity = {
    name: string;
    total: number;
    byModule: { type: string; count: number; income: number }[];
  };

  const weekActivityMap = new Map<string, { total: number; byModule: Map<string, { count: number; income: number }> }>();
  for (const v of recentVisits) {
    if (!v.createdBy) continue;
    if (!weekActivityMap.has(v.createdBy)) {
      weekActivityMap.set(v.createdBy, { total: 0, byModule: new Map() });
    }
    const entry = weekActivityMap.get(v.createdBy)!;
    entry.total++;
    const mod = entry.byModule.get(v.visitType) ?? { count: 0, income: 0 };
    mod.count++;
    mod.income += v.incomeAmount;
    entry.byModule.set(v.visitType, mod);
  }

  const weekActivity: StaffWeekActivity[] = Array.from(weekActivityMap.entries()).map(([name, data]) => ({
    name,
    total: data.total,
    byModule: Array.from(data.byModule.entries())
      .map(([type, stats]) => ({ type, ...stats }))
      .sort((a, b) => b.count - a.count),
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[linear-gradient(135deg,rgba(17,22,20,0.92),rgba(80,111,96,0.12))] p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#9a958b]">Operações</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Equipe
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#c9c2b4]">
              Funcionários e administradores com acesso ao sistema. Defina a senha inicial de cada um.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#d1a04f]/25 bg-[#d1a04f]/10 px-3 py-2 text-sm font-medium text-[#f3dfae]">
            <Users className="size-4" />
            {staff.length} membro{staff.length !== 1 ? "s" : ""}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
        <StaffManagement initialStaff={staff} visitStats={staffVisitStats} />
      </section>

      {/* Atividade dos últimos 7 dias */}
      {weekActivity.length > 0 && (
        <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="size-4 text-[#d1a04f]" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a958b]">
              Atividade — últimos 7 dias
            </p>
          </div>
          <div className="space-y-3">
            {weekActivity.map((member) => (
              <div
                key={member.name}
                className="rounded-xl border border-[rgba(245,241,232,0.07)] bg-[#0b0f0e]/55 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{member.name}</p>
                  <span className="rounded-full border border-[#d1a04f]/30 bg-[#d1a04f]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f3dfae]">
                    {member.total} {member.total === 1 ? "visita" : "visitas"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {member.byModule.map((mod) => (
                    <div
                      key={mod.type}
                      className="flex items-center gap-1.5 rounded-lg border border-[rgba(245,241,232,0.08)] bg-white/[0.03] px-2 py-1"
                    >
                      <span className="text-[11px] font-medium text-[#c9c2b4]">{mod.type}</span>
                      <span className="text-[11px] text-[#5a544c]">·</span>
                      <span className="text-[11px] text-[#9a958b]">{mod.count}×</span>
                      {mod.income > 0 && (
                        <span className="text-[11px] text-[#86efac]">{formatCurrency(mod.income)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
        <ContactPhonesSettings initialPhones={contactPhones} />
      </section>
    </div>
  );
}
