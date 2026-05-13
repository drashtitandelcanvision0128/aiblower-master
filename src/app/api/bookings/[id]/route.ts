import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const pool = getPool();
    const { rows } = await pool.query<{
      id: string;
      status: string;
      customer_name: string;
      customer_phone: string;
      amount_paise: number;
      currency: string;
      start_at: Date | null;
      end_at: Date | null;
    }>(
      `
      SELECT
        b.id,
        b.status::text AS status,
        b.customer_name,
        b.customer_phone,
        b.amount_paise,
        b.currency,
        s.start_at,
        s.end_at
      FROM bookings b
      LEFT JOIN slots s ON s.id = b.slot_id
      WHERE b.id = $1
      LIMIT 1
      `,
      [id],
    );

    const data = rows[0];
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      status: data.status,
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      amountPaise: data.amount_paise,
      currency: data.currency,
      slotStart: data.start_at?.toISOString() ?? null,
      slotEnd: data.end_at?.toISOString() ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
