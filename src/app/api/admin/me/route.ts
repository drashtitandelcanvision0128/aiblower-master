import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query<{ display_name: string | null; email: string }>(
      `SELECT email, display_name FROM admin_users WHERE id = $1 LIMIT 1`,
      [session.adminId],
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      email: row.email,
      displayName: row.display_name ?? "",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
