"use server";

import { requireSession } from "@/lib/auth";
import {
  createRoutePlan,
  listBilliardClientsOverview,
  listBilliardPointHistory,
  listBilliardPoints,
  listRoutePlans,
} from "@/server/services/billiard-route-service";

export async function listRoutePlansAction() {
  const session = await requireSession("BILLIARD");
  return listRoutePlans(session);
}

export async function createRoutePlanAction(data: {
  code: string;
  name: string;
  routeNumber: number;
  description?: string;
}) {
  const session = await requireSession("BILLIARD");
  return createRoutePlan(session, data);
}

export async function listBilliardPointsAction(routeNumber?: number) {
  const session = await requireSession("BILLIARD");
  return listBilliardPoints(session, routeNumber);
}

export async function listBilliardPointHistoryAction(pointId: string) {
  const session = await requireSession("BILLIARD");
  return listBilliardPointHistory(session, pointId);
}

export async function listBilliardClientsOverviewAction() {
  const session = await requireSession("BILLIARD");
  return listBilliardClientsOverview(session);
}
