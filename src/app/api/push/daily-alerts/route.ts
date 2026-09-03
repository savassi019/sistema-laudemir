import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

import { prisma } from "@/lib/prisma";

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL       ?? "mailto:admin@lmgestao.local";
const CRON_SECRET   = process.env.CRON_SECRET       ?? "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-cron-secret") ?? "";
  if (!CRON_SECRET || auth !== CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }

  const now = new Date();
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const report: { org: string; sent: number; alerts: number }[] = [];

  for (const org of orgs) {
    const [overdueContent, overdueEntries, delinquents] = await Promise.all([
      prisma.marketingContent.count({
        where: { organizationId: org.id, status: "PENDING", contentDate: { lt: now } },
      }),
      prisma.financialEntry.count({
        where: { organizationId: org.id, status: "OVERDUE" },
      }),
      prisma.client.count({
        where: { organizationId: org.id, status: "DELINQUENT" },
      }),
    ]);

    const parts: string[] = [];
    if (overdueContent > 0)
      parts.push(`${overdueContent} conteúdo${overdueContent !== 1 ? "s" : ""} atrasado${overdueContent !== 1 ? "s" : ""}`);
    if (overdueEntries > 0)
      parts.push(`${overdueEntries} cobrança${overdueEntries !== 1 ? "s" : ""} vencida${overdueEntries !== 1 ? "s" : ""}`);
    if (delinquents > 0)
      parts.push(`${delinquents} cliente${delinquents !== 1 ? "s" : ""} inadimplente${delinquents !== 1 ? "s" : ""}`);

    const totalAlerts = overdueContent + overdueEntries + delinquents;
    if (totalAlerts === 0) {
      report.push({ org: org.id, sent: 0, alerts: 0 });
      continue;
    }

    const subs = await prisma.pushSubscription.findMany({ where: { organizationId: org.id } });
    const payload = JSON.stringify({
      title: "Sistema LM · Atenção necessária",
      body: parts.join(" · "),
      url: "/dashboard",
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ).catch(async (err: { statusCode?: number }) => {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
          }
          throw err;
        }),
      ),
    );

    report.push({
      org: org.id,
      sent: results.filter((r) => r.status === "fulfilled").length,
      alerts: totalAlerts,
    });
  }

  return NextResponse.json({ ok: true, report });
}
