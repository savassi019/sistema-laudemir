import { hasModuleAccess } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { moduleCatalog } from "@/lib/module-catalog";
import {
  listModuleRecords,
  moduleSlugs,
  type ModuleRecordItem,
  type ModuleSlug,
} from "@/server/services/module-record-service";
import type { SessionData } from "@/types/app";

export type ModuleReportRow = {
  slug: ModuleSlug;
  title: string;
  count: number;
  total: number;
  income: number;
  expense: number;
};

export type WeeklyFinancialBucket = {
  weekStart: string;
  weekEnd: string;
  label: string;
  total: number;
  count: number;
};

export type WeeklyFinancialSummary = {
  totalAmount: number;
  totalCount: number;
  weeks: WeeklyFinancialBucket[];
};

const REPORT_RECORD_CAP = 1000;

function getAccessibleModuleSlugs(session: SessionData): ModuleSlug[] {
  return moduleCatalog
    .filter(
      (item) =>
        moduleSlugs.includes(item.slug as ModuleSlug) && hasModuleAccess(session, item.module),
    )
    .map((item) => item.slug as ModuleSlug);
}

async function listAllRecords(
  session: SessionData,
  from?: Date,
  to?: Date,
): Promise<{ slug: ModuleSlug; records: ModuleRecordItem[] }[]> {
  const slugs = getAccessibleModuleSlugs(session);

  return Promise.all(
    slugs.map(async (slug) => ({
      slug,
      records: await listModuleRecords(session, slug, REPORT_RECORD_CAP, { from, to }),
    })),
  );
}

export async function getModuleReportSummary(
  session: SessionData,
  from?: Date,
  to?: Date,
): Promise<ModuleReportRow[]> {
  const items = moduleCatalog.filter(
    (item) =>
      moduleSlugs.includes(item.slug as ModuleSlug) && hasModuleAccess(session, item.module),
  );
  const titleBySlug = new Map(items.map((item) => [item.slug, item.title]));

  const grouped = await listAllRecords(session, from, to);

  const rows = grouped.map(({ slug, records }) => {
    const total   = records.reduce((sum, r) => sum + (r.amountValue ?? 0), 0);
    const income  = records.reduce((sum, r) => sum + (r.incomeValue  ?? 0), 0);
    const expense = records.reduce((sum, r) => sum + (r.expenseValue ?? 0), 0);

    return { slug, title: titleBySlug.get(slug) ?? slug, count: records.length, total, income, expense };
  });

  return rows.filter((row) => row.count > 0);
}

function getMondayOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

export type MonthlyFinancialBucket = {
  monthKey: string;
  label: string;
  total: number;
  count: number;
};

export type FlatModuleRecord = {
  id: string;
  moduleSlug: ModuleSlug;
  moduleTitle: string;
  title: string;
  amountValue: number;
  incomeValue: number;
  expenseValue: number;
  createdAt: string | Date;
};

export async function getMonthlyFinancialSummary(
  session: SessionData,
  from?: Date,
  to?: Date,
): Promise<{ totalAmount: number; months: MonthlyFinancialBucket[] }> {
  const grouped = await listAllRecords(session, from, to);
  const records = grouped.flatMap((g) => g.records);

  const buckets = new Map<string, { monthStart: Date; total: number; count: number }>();

  for (const record of records) {
    const d = new Date(record.createdAt);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key) ?? { monthStart, total: 0, count: 0 };
    bucket.total += record.amountValue ?? 0;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const months = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({
      monthKey: key,
      label: bucket.monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      total: bucket.total,
      count: bucket.count,
    }));

  const totalAmount = records.reduce((s, r) => s + (r.amountValue ?? 0), 0);

  return { totalAmount, months };
}

export async function getAllModuleRecordsFlat(
  session: SessionData,
  from?: Date,
  to?: Date,
): Promise<FlatModuleRecord[]> {
  const items = moduleCatalog.filter(
    (item) =>
      moduleSlugs.includes(item.slug as ModuleSlug) && hasModuleAccess(session, item.module),
  );
  const titleBySlug = new Map(items.map((item) => [item.slug, item.title]));

  const grouped = await listAllRecords(session, from, to);

  return grouped
    .flatMap(({ slug, records }) =>
      records.map((r) => ({
        id: r.id,
        moduleSlug: slug,
        moduleTitle: titleBySlug.get(slug) ?? slug,
        title: r.title,
        amountValue: r.amountValue ?? 0,
        incomeValue: r.incomeValue ?? 0,
        expenseValue: r.expenseValue ?? 0,
        createdAt: r.createdAt,
      })),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type ModuleMonthBucket = {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  count: number;
};

export type ModuleReport = {
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
  count: number;
  months: ModuleMonthBucket[];
  records: FlatModuleRecord[];
};

export async function getModuleReport(
  session: SessionData,
  slug: ModuleSlug,
  from?: Date,
  to?: Date,
): Promise<ModuleReport> {
  const catalogItem = moduleCatalog.find((m) => m.slug === slug);
  if (!catalogItem || !hasModuleAccess(session, catalogItem.module)) {
    return { totalIncome: 0, totalExpense: 0, totalNet: 0, count: 0, months: [], records: [] };
  }

  const moduleTitle = catalogItem.title;
  const records = await listModuleRecords(session, slug, REPORT_RECORD_CAP, { from, to });

  const totalIncome = records.reduce((s, r) => s + (r.incomeValue ?? 0), 0);
  const totalExpense = records.reduce((s, r) => s + (r.expenseValue ?? 0), 0);
  const totalNet = records.reduce((s, r) => s + (r.amountValue ?? 0), 0);

  const buckets = new Map<
    string,
    { monthStart: Date; income: number; expense: number; net: number; count: number }
  >();

  for (const record of records) {
    const d = new Date(record.createdAt);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key) ?? { monthStart, income: 0, expense: 0, net: 0, count: 0 };
    bucket.income += record.incomeValue ?? 0;
    bucket.expense += record.expenseValue ?? 0;
    bucket.net += record.amountValue ?? 0;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const months = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({
      monthKey: key,
      label: bucket.monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      income: bucket.income,
      expense: bucket.expense,
      net: bucket.net,
      count: bucket.count,
    }));

  const flatRecords: FlatModuleRecord[] = records
    .map((r) => ({
      id: r.id,
      moduleSlug: slug,
      moduleTitle,
      title: r.title,
      amountValue: r.amountValue ?? 0,
      incomeValue: r.incomeValue ?? 0,
      expenseValue: r.expenseValue ?? 0,
      createdAt:
        typeof r.createdAt === "string" ? r.createdAt : (r.createdAt as Date).toISOString(),
    }))
    .sort(
      (a, b) =>
        new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime(),
    )
    .reverse();

  return { totalIncome, totalExpense, totalNet, count: records.length, months, records: flatRecords };
}

export async function getWeeklyFinancialSummary(
  session: SessionData,
  from?: Date,
  to?: Date,
): Promise<WeeklyFinancialSummary> {
  const grouped = await listAllRecords(session, from, to);
  const records = grouped.flatMap((group) => group.records);

  const buckets = new Map<string, { weekStart: Date; total: number; count: number }>();

  for (const record of records) {
    const monday = getMondayOfWeek(new Date(record.createdAt));
    const key = monday.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? { weekStart: monday, total: 0, count: 0 };
    bucket.total += record.amountValue ?? 0;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const weeks = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => {
      const saturday = new Date(bucket.weekStart);
      saturday.setDate(saturday.getDate() + 5);

      return {
        weekStart: key,
        weekEnd: saturday.toISOString().slice(0, 10),
        label: `${formatShortDate(bucket.weekStart)} a ${formatShortDate(saturday)}`,
        total: bucket.total,
        count: bucket.count,
      };
    });

  const totalAmount = records.reduce((sum, record) => sum + (record.amountValue ?? 0), 0);

  return { totalAmount, totalCount: records.length, weeks };
}
