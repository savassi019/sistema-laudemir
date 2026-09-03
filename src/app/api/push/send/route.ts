import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

import { prisma } from "@/lib/prisma";

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL       ?? "mailto:admin@lmgestao.local";

// Internal cron secret — set CRON_SECRET in env for security
const CRON_SECRET = process.env.CRON_SECRET ?? "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
  // Require a shared secret so only the server cron can trigger this
  const auth = req.headers.get("x-cron-secret") ?? "";
  if (CRON_SECRET && auth !== CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }

  try {
    const body = await req.json() as {
      organizationId?: string;
      title: string;
      message: string;
      url?: string;
    };

    const where = body.organizationId
      ? { organizationId: body.organizationId }
      : {};

    const subs = await prisma.pushSubscription.findMany({ where });
    if (subs.length === 0) return NextResponse.json({ sent: 0 });

    const payload = JSON.stringify({
      title: body.title,
      body: body.message,
      url: body.url ?? "/dashboard",
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ).catch(async (err: { statusCode?: number }) => {
          // 404/410 means subscription is gone — remove it
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
          }
          throw err;
        }),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ sent, total: subs.length });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
