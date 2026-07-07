import { z } from "zod";
import { NextResponse } from "next/server";

import { authenticateUser, getAuthCookieName, signSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const globalForLoginAttempts = globalThis as unknown as {
  loginAttempts?: Map<string, { count: number; resetAt: number }>;
};
const loginAttempts =
  globalForLoginAttempts.loginAttempts ?? new Map<string, { count: number; resetAt: number }>();
globalForLoginAttempts.loginAttempts = loginAttempts;

function isRateLimited(key: string) {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(key);
    return false;
  }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(key: string) {
  const entry = loginAttempts.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Informe e-mail e senha validos." },
      { status: 400 },
    );
  }

  const emailKey = parsed.data.email.toLowerCase();

  if (isRateLimited(emailKey)) {
    return NextResponse.json(
      { error: "Muitas tentativas para este e-mail. Aguarde alguns minutos e tente de novo." },
      { status: 429 },
    );
  }

  const session = await authenticateUser(parsed.data.email, parsed.data.password);

  if (!session) {
    recordFailedAttempt(emailKey);
    return NextResponse.json(
      { error: "Credenciais invalidas ou usuario inativo." },
      { status: 401 },
    );
  }

  loginAttempts.delete(emailKey);

  const token = await signSession(session);
  const response = NextResponse.json({
    ok: true,
    session,
  });

  response.cookies.set(getAuthCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SECURE_COOKIES === "true",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
