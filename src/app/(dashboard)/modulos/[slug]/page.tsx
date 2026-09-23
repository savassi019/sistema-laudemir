import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { requireSession } from "@/lib/auth";
import { currentBusinessDate } from "@/lib/business-date";
import { getModuleBySlug } from "@/lib/module-catalog";
import { listModuleFinancialEntries } from "@/server/services/finance-service";
import {
  listModuleClients,
  listModuleVisitTargets,
  moduleSlugs,
  type ModuleSlug,
} from "@/server/services/module-record-service";
import { getModuleScopeSummary } from "@/server/services/module-scope-service";
import { getModuleUnvisitedTargets } from "@/server/services/visit-service";
import type { ClientVisitSummary } from "@/types/app";

export const dynamic = "force-dynamic";

function isRecordSlug(slug: string): slug is ModuleSlug {
  return moduleSlugs.includes(slug as ModuleSlug);
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // O modulo se autoriza pela propria permissao abaixo. Exigir DASHBOARD
  // aqui quebrava justamente os logins com acesso avulso.
  const session = await requireSession();
  const { slug } = await params;
  const item = getModuleBySlug(slug);

  if (!item) {
    notFound();
  }

  if (session.role !== "OWNER" && !session.modules.includes(item.module)) {
    notFound();
  }

  const fieldSlugs = ["bilhar-pebolim", "maquinas-de-pelucia", "bx", "h-caca-niquel", "carreta-kids", "locacao"];
  const isField = fieldSlugs.includes(item.slug);
  const financeDailyOnly = session.role === "ADMIN";
  const initialFinanceDate = financeDailyOnly
    ? currentBusinessDate()
    : undefined;
  const hideFinancials = session.role === "STAFF";
  const [scopeSummary, visitTargets, moduleClients, financialEntries] = await Promise.all([
    getModuleScopeSummary(session, item.module, isRecordSlug(item.slug) ? item.slug : null),
    isField && isRecordSlug(item.slug) ? listModuleVisitTargets(session, item.slug) : Promise.resolve([]),
    isRecordSlug(item.slug) ? listModuleClients(session, item.slug) : Promise.resolve([]),
    hideFinancials
      ? Promise.resolve([])
      : listModuleFinancialEntries(session, item.module, isRecordSlug(item.slug) ? item.slug : null),
  ]);
  const overdueClients: ClientVisitSummary[] = isField
    ? await getModuleUnvisitedTargets(session, visitTargets, 15)
    : [];
  return (
    <div className="space-y-3 md:space-y-4">
      <Link
        href="/modulos"
        className="inline-flex items-center gap-1.5 text-xs text-[#9a958b] transition hover:text-[#c9c2b4]"
      >
        <ArrowLeft className="size-3" />
        Módulos
      </Link>

      <ModuleWorkspace
        slug={item.slug}
        moduleTitle={item.title}
        summary={scopeSummary}
        clients={visitTargets}
        overdueClients={overdueClients}
        moduleClients={moduleClients}
        financialEntries={financialEntries}
        financeInitialFrom={initialFinanceDate}
        financeInitialTo={initialFinanceDate}
        financeDailyOnly={financeDailyOnly}
        hideFinancials={hideFinancials}
      />

    </div>
  );
}
