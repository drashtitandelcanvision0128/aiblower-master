import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth/admin-cookie";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearAdminSessionCookie(res);
  return res;
}
