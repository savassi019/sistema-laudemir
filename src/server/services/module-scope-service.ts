import {
  listModuleClients,
  listModuleRecords,
  type ModuleSlug,
} from "@/server/services/module-record-service";
import type { ModuleName, SessionData } from "@/types/app";

export type ModuleScopeSummary = {
  clientsCount: number;
  incomeAmount: number;
  expenseAmount: number;
  pendingAmount: number;
  balanceAmount: number;
};

const SCOPE_RECORD_CAP = 5000;

const demoSummaryByModule: Partial<Record<ModuleName, ModuleScopeSummary>> = {
  CARRETA_KIDS: {
    clientsCount: 8,
    incomeAmount: 4260,
    expenseAmount: 710,
    pendingAmount: 320,
    balanceAmount: 3550,
  },
  RENTAL: {
    clientsCount: 6,
    incomeAmount: 7800,
    expenseAmount: 950,
    pendingAmount: 2100,
    balanceAmount: 6850,
  },
  BILLIARD: {
    clientsCount: 14,
    incomeAmount: 12400,
    expenseAmount: 2850,
    pendingAmount: 980,
    balanceAmount: 9550,
  },
  PLUSH: {
    clientsCount: 11,
    incomeAmount: 9680,
    expenseAmount: 2420,
    pendingAmount: 760,
    balanceAmount: 7260,
  },
  BX: {
    clientsCount: 9,
    incomeAmount: 6420,
    expenseAmount: 1840,
    pendingAmount: 620,
    balanceAmount: 4580,
  },
  SLOT_H: {
    clientsCount: 7,
    incomeAmount: 15300,
    expenseAmount: 4360,
    pendingAmount: 1440,
    balanceAmount: 10940,
  },
};

const fallbackSummary: ModuleScopeSummary = {
  clientsCount: 0,
  incomeAmount: 0,
  expenseAmount: 0,
  pendingAmount: 0,
  balanceAmount: 0,
};

function getDemoModuleScopeSummary(module: ModuleName): ModuleScopeSummary {
  return (
    demoSummaryByModule[module] ?? {
      clientsCount: 3,
      incomeAmount: 2400,
      expenseAmount: 480,
      pendingAmount: 0,
      balanceAmount: 1920,
    }
  );
}

export async function getModuleScopeSummary(
  session: SessionData,
  module: ModuleName,
  slug: ModuleSlug | null,
): Promise<ModuleScopeSummary> {
  if (process.env.DEMO_MODE !== "false") {
    return getDemoModuleScopeSummary(module);
  }

  if (!slug) {
    return fallbackSummary;
  }

  try {
    const [records, clients] = await Promise.all([
      listModuleRecords(session, slug, SCOPE_RECORD_CAP),
      listModuleClients(session, slug, SCOPE_RECORD_CAP),
    ]);

    const incomeAmount = records.reduce((sum, record) => sum + (record.incomeValue ?? 0), 0);
    const expenseAmount = records.reduce((sum, record) => sum + (record.expenseValue ?? 0), 0);

    return {
      clientsCount: clients.length,
      incomeAmount,
      expenseAmount,
      pendingAmount: 0,
      balanceAmount: incomeAmount - expenseAmount,
    };
  } catch {
    return fallbackSummary;
  }
}
