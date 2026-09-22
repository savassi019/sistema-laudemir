import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { demoAccounts } from "@/data/demo";
import { canAccessModule } from "@/lib/access-policy";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { ModuleName, SessionData } from "@/types/app";

const ALL_MODULES: ModuleName[] = [
  "CORE", "DASHBOARD", "CLIENTS", "FINANCE", "REPORTS", "SETTINGS",
  "CARRETA_KIDS", "RENTAL", "PLUSH", "BILLIARD", "BRASIL_BETS",
  "MACHINE", "CONDOMINIUM_MARKET", "MARKETING", "PERSONAL_FINANCE", "BX", "SLOT_H",
];

const AUTH_COOKIE = "sgm_session";
const TOKEN_TTL = 60 * 60 * 12;

function getJwtSecret() {
  return new TextEncoder().encode(env.jwtSecret);
}

export async function signSession(session: SessionData) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL}s`)
    .sign(getJwtSecret());
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());

  return payload as unknown as SessionData;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const tokenSession = await verifySession(token);

    // Contas de demonstracao nao existem no banco. Em producao, porem, o
    // token nao pode ser a fonte definitiva das permissoes: um modulo
    // removido ou um usuario desativado precisa perder o acesso na proxima
    // requisicao, e nao apenas quando o JWT expirar (ate 12 horas depois).
    if (env.demoMode) {
      return tokenSession;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: tokenSession.userId,
        organizationId: tokenSession.organizationId,
        status: "ACTIVE",
      },
      include: { modulePermissions: true },
    });

    if (!user) {
      return null;
    }

    const modules: ModuleName[] =
      user.role === "OWNER"
        ? ALL_MODULES
        : user.modulePermissions
            .filter((permission) => permission.canView)
            .map((permission) => permission.module as ModuleName);

    return {
      userId: user.id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role as SessionData["role"],
      modules,
    } satisfies SessionData;
  } catch {
    return null;
  }
}

export async function requireSession(module?: ModuleName) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (module && !hasModuleAccess(session, module)) {
    redirect("/dashboard?denied=1");
  }

  return session;
}

export function hasModuleAccess(session: SessionData, module: ModuleName) {
  return canAccessModule(session.role, session.modules, module);
}

export async function authenticateUser(email: string, password: string) {
  if (env.demoMode) {
    const account = demoAccounts.find(
      (item) =>
        item.email.toLowerCase() === email.toLowerCase() &&
        item.password === password,
    );

    return account?.session ?? null;
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { modulePermissions: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  const modules: ModuleName[] =
    user.role === "OWNER"
      ? ALL_MODULES
      : user.modulePermissions
          .filter((permission) => permission.canView)
          .map((permission) => permission.module as ModuleName);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    userId: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role as SessionData["role"],
    modules,
  } satisfies SessionData;
}

export function getAuthCookieName() {
  return AUTH_COOKIE;
}
