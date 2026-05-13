import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  start_at: Date;
  end_at: Date;
  price_paise: string;
  capacity: string;
  is_active: boolean;
};

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query<Row>(
      `
      SELECT id, start_at, end_at, price_paise::text AS price_paise, capacity::text AS capacity, is_active
      FROM slots
      WHERE is_active = true
      ORDER BY start_at ASC
      LIMIT 400
      `,
    );

    const slots = rows.map((r) => ({
      id: r.id,
      start_at: r.start_at.toISOString(),
      end_at: r.end_at.toISOString(),
      price_paise: Number(r.price_paise),
      capacity: Number(r.capacity),
      is_active: r.is_active,
    }));

    return NextResponse.json({ slots });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
