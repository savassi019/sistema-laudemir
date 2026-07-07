import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/types/app";

const OWNER_WHATSAPP_KEY = "OWNER_WHATSAPP_PHONE";
const STAFF_WHATSAPP_KEY = "STAFF_WHATSAPP_PHONE";

export type ContactPhones = {
  ownerPhone: string;
  staffPhone: string;
};

async function getSettingValue(session: SessionData, key: string): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({
    where: { organizationId_key: { organizationId: session.organizationId, key } },
  });

  return typeof setting?.value === "string" ? setting.value : "";
}

export async function getContactPhones(session: SessionData): Promise<ContactPhones> {
  const [ownerPhone, staffPhone] = await Promise.all([
    getSettingValue(session, OWNER_WHATSAPP_KEY),
    getSettingValue(session, STAFF_WHATSAPP_KEY),
  ]);

  return { ownerPhone, staffPhone };
}

export async function setContactPhones(
  session: SessionData,
  payload: { ownerPhone: string; staffPhone: string },
): Promise<ContactPhones> {
  await Promise.all([
    prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId: session.organizationId, key: OWNER_WHATSAPP_KEY } },
      create: {
        organizationId: session.organizationId,
        key: OWNER_WHATSAPP_KEY,
        value: payload.ownerPhone,
        updatedById: session.userId,
      },
      update: { value: payload.ownerPhone, updatedById: session.userId },
    }),
    prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId: session.organizationId, key: STAFF_WHATSAPP_KEY } },
      create: {
        organizationId: session.organizationId,
        key: STAFF_WHATSAPP_KEY,
        value: payload.staffPhone,
        updatedById: session.userId,
      },
      update: { value: payload.staffPhone, updatedById: session.userId },
    }),
  ]);

  return { ownerPhone: payload.ownerPhone, staffPhone: payload.staffPhone };
}
