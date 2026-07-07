import { NextResponse } from "next/server";

import { getAuthCookieName } from "@/lib/auth";

export async function POST(request: Request) {
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const redirectUrl = host ? `${protocol}://${host}/login` : new URL("/login", request.url);

  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.SECURE_COOKIES !== "false",
    path: "/",
    maxAge: 0,
  });

  return response;
}
