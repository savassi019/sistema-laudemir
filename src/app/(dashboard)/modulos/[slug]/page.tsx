import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ModuleWorkspace } from "@/components/modules/module-workspace";
import { requireSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getModuleBySlug } from "@/lib/module-catalog";
import { listModuleFinancialEntries } from "@/server/services/finance-service";
import {
  listModuleClients,
  listModuleRecords,
  listModuleVisitTargets,
  moduleSlugs,
  type ModuleRecordItem,
  type ModuleSlug,
} from "@/server/services/module-record-service";
import { getModuleScopeSummary } from "@/server/services/module-scope-service";
import { getModuleUnvisitedTargets } from "@/server/services/visit-service";
import type { ClientVisitSummary } from "@/types/app";

export const dynamic = "force-dynamic";

function isRecordSlug(slug: string): slug is ModuleSlug {
  return moduleSlugs.includes(slug as ModuleSlug);
}

function buildFallbackRecords(
  moduleTitle: string,
  scopeSummary: Awaited<ReturnType<typeof getModuleScopeSummary>>,
): ModuleRecordItem[] {
  return [
    {
      id: `${moduleTitle}-demo-1`,
      title: "Ultimo fechamento",
      summary: `Historico de ${moduleTitle}`,
      details: [
        `Entradas: ${formatCurrency(scopeSummary.incomeAmount)}`,
        `Despesas: ${formatCurrency(scopeSummary.expenseAmount)}`,
      ],
      amount: formatCurrency(scopeSummary.balanceAmount),
      badge: "Demo",
      createdAt: new Date().toISOString(),
    },
    {
      id: `${moduleTitle}-demo-2`,
      title: "Cliente vinculado",
      summary: "Cadastro do modulo",
      details: [`Clientes ativos: ${scopeSummary.clientsCount}`],
      badge: "Modulo",
      createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    },
  ];
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireSession("DASHBOARD");
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
  const hideFinancials = session.role === "STAFF";
  const [scopeSummary, records, visitTargets, moduleClients, financialEntries] = await Promise.all([
    getModuleScopeSummary(session, item.module, isRecordSlug(item.slug) ? item.slug : null),
    isRecordSlug(item.slug) ? listModuleRecords(session, item.slug, 6) : Promise.resolve([]),
    isField && isRecordSlug(item.slug) ? listModuleVisitTargets(session, item.slug) : Promise.resolve([]),
    isRecordSlug(item.slug) ? listModuleClients(session, item.slug) : Promise.resolve([]),
    hideFinancials ? Promise.resolve([]) : listModuleFinancialEntries(session, item.module),
  ]);
  const overdueClients: ClientVisitSummary[] = isField
    ? await getModuleUnvisitedTargets(session, visitTargets, 15)
    : [];
  const recentRecords =
    records.length > 0 ? records : buildFallbackRecords(item.title, scopeSummary);

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
        recentRecords={recentRecords}
        clients={visitTargets}
        overdueClients={overdueClients}
        moduleClients={moduleClients}
        financialEntries={financialEntries}
        hideFinancials={hideFinancials}
      />

    </div>
  );
}
