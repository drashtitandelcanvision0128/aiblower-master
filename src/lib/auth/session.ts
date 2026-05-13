import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth/constants";
import { verifyAdminToken } from "@/lib/auth/jwt";

export type AdminSession = { adminId: string; email: string };

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { sub, email } = await verifyAdminToken(token);
    return { adminId: sub, email };
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  return s;
}
