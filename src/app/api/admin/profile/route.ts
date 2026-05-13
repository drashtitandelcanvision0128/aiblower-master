import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { setAdminSessionCookie } from "@/lib/auth/admin-cookie";
import { signAdminToken } from "@/lib/auth/jwt";
import { getAdminSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db/pool";
import { adminProfilePatchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminProfilePatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const hasDisplay = body.displayName !== undefined;
  const hasEmail = body.email !== undefined;
  const hasPassword = Boolean(body.newPassword);

  if (!hasDisplay && !hasEmail && !hasPassword) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      id: string;
      email: string;
      password_hash: string;
    }>(`SELECT id, email, password_hash FROM admin_users WHERE id = $1 LIMIT 1`, [session.adminId]);

    const admin = rows[0];
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const changingEmail = hasEmail && body.email !== undefined && body.email !== admin.email;
    if ((changingEmail || hasPassword) && !body.currentPassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 400 });
    }

    if (changingEmail || hasPassword) {
      if (!bcrypt.compareSync(body.currentPassword ?? "", admin.password_hash)) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
      }
    }

    if (changingEmail && body.email) {
      const clash = await pool.query(`SELECT 1 FROM admin_users WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1`, [
        body.email,
        admin.id,
      ]);
      if (clash.rowCount && clash.rowCount > 0) {
        return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
      }
      await pool.query(`UPDATE admin_users SET email = $1, updated_at = now() WHERE id = $2`, [
        body.email,
        admin.id,
      ]);
    }

    if (hasPassword && body.newPassword) {
      const hash = bcrypt.hashSync(body.newPassword, 12);
      await pool.query(`UPDATE admin_users SET password_hash = $1, updated_at = now() WHERE id = $2`, [
        hash,
        admin.id,
      ]);
    }

    if (hasDisplay) {
      await pool.query(`UPDATE admin_users SET display_name = $1, updated_at = now() WHERE id = $2`, [
        body.displayName?.trim() || null,
        admin.id,
      ]);
    }

    const { rows: fresh } = await pool.query<{ email: string }>(
      `SELECT email FROM admin_users WHERE id = $1 LIMIT 1`,
      [admin.id],
    );
    const nextEmail = fresh[0]?.email ?? admin.email;

    const res = NextResponse.json({ ok: true, email: nextEmail });
    const token = await signAdminToken({ sub: admin.id, email: nextEmail });
    setAdminSessionCookie(res, token);
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
