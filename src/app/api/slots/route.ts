import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

type SlotRow = {
  id: string;
  start_at: Date;
  end_at: Date;
  price_paise: number;
  capacity: number;
};

export async function GET() {
  try {
    const pool = getPool();
    const nowIso = new Date().toISOString();

    const { rows: slots } = await pool.query<SlotRow>(
      `
      SELECT id, start_at, end_at, price_paise, capacity
      FROM slots
      WHERE is_active = true AND start_at > $1::timestamptz
      ORDER BY start_at ASC
      LIMIT 500
      `,
      [nowIso],
    );

    const { rows: confirmed } = await pool.query<{ slot_id: string }>(
      `SELECT slot_id FROM bookings WHERE status = 'confirmed'`,
    );

    const counts = new Map<string, number>();
    for (const row of confirmed) {
      counts.set(row.slot_id, (counts.get(row.slot_id) ?? 0) + 1);
    }

    const enriched = slots.map((s) => {
      const confirmedCount = counts.get(s.id) ?? 0;
      const isBooked = confirmedCount >= s.capacity;
      return {
        id: s.id,
        start_at: s.start_at.toISOString(),
        end_at: s.end_at.toISOString(),
        price_paise: s.price_paise,
        capacity: s.capacity,
        booked_count: confirmedCount,
        is_booked: isBooked,
        status: isBooked ? "booked" : "available",
      };
    });

    return NextResponse.json({ slots: enriched });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
}
