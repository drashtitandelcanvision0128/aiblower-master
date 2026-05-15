import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { pendingBookingCutoffIso } from "@/lib/slot-availability";

export const dynamic = "force-dynamic";

type SlotRow = {
  id: string;
  start_at: Date;
  end_at: Date;
  capacity: number;
};

export async function GET() {
  try {
    const pool = getPool();
    const nowIso = new Date().toISOString();
    const pendingCutoff = pendingBookingCutoffIso();

    const { rows: slots } = await pool.query<SlotRow>(
      `
      SELECT id, start_at, end_at, capacity
      FROM slots
      WHERE is_active = true AND start_at > $1::timestamptz
      ORDER BY start_at ASC
      LIMIT 800
      `,
      [nowIso],
    );

    const { rows: holds } = await pool.query<{ slot_id: string; n: string }>(
      `
      SELECT slot_id, count(*)::text AS n
      FROM bookings
      WHERE status = 'confirmed'
         OR (status = 'pending_payment' AND created_at >= $1::timestamptz)
      GROUP BY slot_id
      `,
      [pendingCutoff],
    );

    const counts = new Map<string, number>();
    for (const row of holds) {
      counts.set(row.slot_id, Number(row.n));
    }

    const enriched = slots.map((s) => {
      const heldCount = counts.get(s.id) ?? 0;
      const isBooked = heldCount >= s.capacity;
      return {
        id: s.id,
        start_at: s.start_at.toISOString(),
        end_at: s.end_at.toISOString(),
        capacity: s.capacity,
        booked_count: heldCount,
        is_booked: isBooked,
        status: isBooked ? "booked" : "available",
      };
    });

    return NextResponse.json({ slots: enriched });
  } catch (e) {
    console.error("GET /api/slots failed:", e);
    if (e instanceof Error && e.message.startsWith("Database not configured")) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
}
