import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth/constants";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...cookieBase,
    maxAge: 0,
  });
}
