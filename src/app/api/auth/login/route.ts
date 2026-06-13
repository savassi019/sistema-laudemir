import { z } from "zod";
import { NextResponse } from "next/server";

import { authenticateUser, getAuthCookieName, signSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Informe e-mail e senha validos." },
      { status: 400 },
    );
  }

  const session = await authenticateUser(parsed.data.email, parsed.data.password);

  if (!session) {
    return NextResponse.json(
      { error: "Credenciais invalidas ou usuario inativo." },
      { status: 401 },
    );
  }

  const token = await signSession(session);
  const response = NextResponse.json({
    ok: true,
    session,
  });

  response.cookies.set(getAuthCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
