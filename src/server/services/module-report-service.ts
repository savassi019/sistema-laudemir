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
    const total = records.reduce((sum, record) => sum + (record.amountValue ?? 0), 0);

    return { slug, title: titleBySlug.get(slug) ?? slug, count: records.length, total };
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
