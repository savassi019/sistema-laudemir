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
  // O alerta so avisava depois que o prazo passou -- lembrete que chega
  // atrasado nao e lembrete. Esta janela cobre os proximos 3 dias.
  const inicioDeHoje = new Date(now);
  inicioDeHoje.setHours(0, 0, 0, 0);
  const limiteProximos = new Date(inicioDeHoje);
  limiteProximos.setDate(limiteProximos.getDate() + 4); // hoje + 3 dias inteiros
  const quinzeDiasAtras = new Date(inicioDeHoje);
  quinzeDiasAtras.setDate(quinzeDiasAtras.getDate() - 15);

  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const report: { org: string; sent: number; alerts: number }[] = [];

  for (const org of orgs) {
    const [
      overdueContent,
      upcomingContent,
      overdueEntries,
      upcomingEntries,
      delinquents,
      billiardsWithoutVisit,
      plushWithoutVisit,
      slotsWithoutVisit,
    ] = await Promise.all([
      prisma.marketingContent.count({
        where: { organizationId: org.id, status: "PENDING", contentDate: { lt: inicioDeHoje } },
      }),
      prisma.marketingContent.count({
        where: {
          organizationId: org.id,
          status: "PENDING",
          contentDate: { gte: inicioDeHoje, lt: limiteProximos },
        },
      }),
      prisma.financialEntry.count({
        where: {
          organizationId: org.id,
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          OR: [{ status: "OVERDUE" }, { dueDate: { lt: inicioDeHoje } }],
        },
      }),
      prisma.financialEntry.count({
        where: {
          organizationId: org.id,
          status: { in: ["PENDING", "PARTIAL"] },
          dueDate: { gte: inicioDeHoje, lt: limiteProximos },
        },
      }),
      prisma.client.count({
        where: { organizationId: org.id, status: "DELINQUENT" },
      }),
      prisma.billiardPoint.count({
        where: {
          organizationId: org.id,
          collections: { none: { collectionDate: { gte: quinzeDiasAtras } } },
        },
      }),
      prisma.plushMachine.count({
        where: {
          organizationId: org.id,
          active: true,
          collections: { none: { createdAt: { gte: quinzeDiasAtras } } },
        },
      }),
      prisma.slotMachine.count({
        where: {
          organizationId: org.id,
          active: true,
          collections: { none: { occurredAt: { gte: quinzeDiasAtras } } },
        },
      }),
    ]);

    const parts: string[] = [];
    if (overdueContent > 0)
      parts.push(`${overdueContent} conteúdo${overdueContent !== 1 ? "s" : ""} atrasado${overdueContent !== 1 ? "s" : ""}`);
    if (upcomingContent > 0)
      parts.push(`${upcomingContent} vencendo em 3 dias`);
    if (overdueEntries > 0)
      parts.push(`${overdueEntries} cobrança${overdueEntries !== 1 ? "s" : ""} vencida${overdueEntries !== 1 ? "s" : ""}`);
    if (upcomingEntries > 0)
      parts.push(`${upcomingEntries} cobrança${upcomingEntries !== 1 ? "s" : ""} vencendo em 3 dias`);
    if (delinquents > 0)
      parts.push(`${delinquents} cliente${delinquents !== 1 ? "s" : ""} inadimplente${delinquents !== 1 ? "s" : ""}`);
    const unvisitedMachines = billiardsWithoutVisit + plushWithoutVisit + slotsWithoutVisit;
    if (unvisitedMachines > 0)
      parts.push(`${unvisitedMachines} ponto${unvisitedMachines !== 1 ? "s" : ""} sem fechamento ha 15 dias`);

    const totalAlerts = overdueContent + upcomingContent + overdueEntries + upcomingEntries + delinquents + unvisitedMachines;
    if (totalAlerts === 0) {
      report.push({ org: org.id, sent: 0, alerts: 0 });
      continue;
    }

    const managementUsers = await prisma.user.findMany({
      where: { organizationId: org.id, role: { in: ["OWNER", "ADMIN"] }, status: "ACTIVE" },
      select: { id: true },
    });
    const subs = await prisma.pushSubscription.findMany({
      where: { organizationId: org.id, userId: { in: managementUsers.map((user) => user.id) } },
    });
    const payload = JSON.stringify({
      title: "Sistema LM · Atenção necessária",
      body: parts.join(" · "),
      url: "/painel",
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
