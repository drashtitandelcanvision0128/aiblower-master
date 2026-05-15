import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  amount_paise: string;
  currency: string;
  created_at: Date;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  slot_id: string;
  booking_type: string;
  booking_date: Date;
  s_id: string;
  s_start_at: Date;
  s_end_at: Date;
  s_price_paise: string;
  s_capacity: string;
  s_is_active: boolean;
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
      SELECT
        b.id,
        b.customer_name,
        b.customer_phone,
        b.status::text AS status,
        b.amount_paise::text AS amount_paise,
        b.currency,
        b.created_at,
        b.razorpay_order_id,
        b.razorpay_payment_id,
        b.slot_id,
        b.booking_type::text AS booking_type,
        b.booking_date,
        s.id AS s_id,
        s.start_at AS s_start_at,
        s.end_at AS s_end_at,
        s.price_paise::text AS s_price_paise,
        s.capacity::text AS s_capacity,
        s.is_active AS s_is_active
      FROM bookings b
      JOIN slots s ON s.id = b.slot_id
      ORDER BY b.created_at DESC
      LIMIT 300
      `,
    );

    const bookings = rows.map((r) => ({
      id: r.id,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      status: r.status,
      amount_paise: Number(r.amount_paise),
      currency: r.currency,
      created_at: r.created_at.toISOString(),
      razorpay_order_id: r.razorpay_order_id,
      razorpay_payment_id: r.razorpay_payment_id,
      slot_id: r.slot_id,
      booking_type: r.booking_type,
      booking_date: r.booking_date.toISOString().slice(0, 10),
      slots: {
        id: r.s_id,
        start_at: r.s_start_at.toISOString(),
        end_at: r.s_end_at.toISOString(),
        price_paise: Number(r.s_price_paise),
        capacity: Number(r.s_capacity),
        is_active: r.s_is_active,
      },
    }));

    return NextResponse.json({ bookings });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
