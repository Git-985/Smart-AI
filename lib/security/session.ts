import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const sessionCookie = "smart_ai_session";

export function requestSession(request: Request): string | undefined {
  const value = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

export function createSession(): string {
  return randomBytes(32).toString("hex");
}

export function attachSession(response: NextResponse, value: string, request: Request) {
  response.cookies.set(sessionCookie, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 86400,
  });
  return response;
}
