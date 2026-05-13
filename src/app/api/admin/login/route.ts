import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setAdminSessionCookie } from "@/lib/auth/admin-cookie";
import { signAdminToken } from "@/lib/auth/jwt";
import { getPool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json: unknown = await request.json();
    const parsed = loginSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const pool = getPool();
    const { rows } = await pool.query<{
      id: string;
      email: string;
      password_hash: string;
    }>(
      `SELECT id, email, password_hash FROM admin_users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );
    const row = rows[0];
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await signAdminToken({ sub: row.id, email: row.email });
    const res = NextResponse.json({ ok: true });
    setAdminSessionCookie(res, token);
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
