import { Users } from "lucide-react";

import { ContactPhonesSettings } from "@/components/equipe/contact-phones-settings";
import { StaffManagement } from "@/components/equipe/staff-management";
import { requireSession } from "@/lib/auth";
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

      <section className="rounded-2xl border border-[rgba(245,241,232,0.1)] bg-[#111614]/82 p-4 md:p-5">
        <ContactPhonesSettings initialPhones={contactPhones} />
      </section>
    </div>
  );
}
