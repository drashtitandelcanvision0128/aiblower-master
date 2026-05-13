import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { getRazorpay } from "@/lib/razorpay";
import { initiateBookingSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const PENDING_TTL_MS = 30 * 60 * 1000;

function cleanEnv(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.replace(/^['"]+|['"]+$/g, "");
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = initiateBookingSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { slotId, customerName, customerPhone } = parsed.data;
    const pool = getPool();

    const cutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
    await pool.query(
      `UPDATE bookings SET status = 'expired', updated_at = now()
       WHERE status = 'pending_payment' AND created_at < $1::timestamptz`,
      [cutoff],
    );

    const { rows: slotRows } = await pool.query<{
      id: string;
      start_at: Date;
      end_at: Date;
      price_paise: number;
      capacity: number;
      is_active: boolean;
    }>(
      `SELECT id, start_at, end_at, price_paise, capacity, is_active
       FROM slots WHERE id = $1 LIMIT 1`,
      [slotId],
    );

    const slot = slotRows[0];
    if (!slot || !slot.is_active) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    if (new Date(slot.start_at) <= new Date()) {
      return NextResponse.json({ error: "Slot is no longer available" }, { status: 400 });
    }

    const { rows: countRows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM bookings WHERE slot_id = $1 AND status = 'confirmed'`,
      [slotId],
    );
    const confirmedCount = Number(countRows[0]?.n ?? 0);
    if (confirmedCount >= slot.capacity) {
      return NextResponse.json({ error: "This slot is already booked" }, { status: 409 });
    }

    const { rows: bookingRows } = await pool.query<{
      id: string;
      amount_paise: number;
      currency: string;
    }>(
      `INSERT INTO bookings (
        slot_id, customer_name, customer_phone, status, amount_paise, currency
      ) VALUES ($1, $2, $3, 'pending_payment', $4, 'INR')
      RETURNING id, amount_paise, currency`,
      [slotId, customerName, customerPhone, slot.price_paise],
    );

    const booking = bookingRows[0];
    if (!booking) {
      return NextResponse.json({ error: "Could not create booking" }, { status: 500 });
    }

    const receipt = booking.id.replace(/-/g, "").slice(0, 40);
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: booking.amount_paise,
      currency: booking.currency,
      receipt,
      notes: {
        booking_id: booking.id,
      },
    });

    const orderUpdate = await pool.query(`UPDATE bookings SET razorpay_order_id = $1 WHERE id = $2`, [
      order.id,
      booking.id,
    ]);
    if (orderUpdate.rowCount === 0) {
      return NextResponse.json({ error: "Could not link payment order" }, { status: 500 });
    }

    // Prefer RAZORPAY_KEY_ID: it is read at runtime. NEXT_PUBLIC_* can be empty in production if
    // the image was built without that env (Razorpay then requests .../build/undefined).
    const keyId =
      cleanEnv(process.env.RAZORPAY_KEY_ID) || cleanEnv(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
    if (!keyId) {
      console.error("[initiate] missing RAZORPAY_KEY_ID and NEXT_PUBLIC_RAZORPAY_KEY_ID");
      return NextResponse.json(
        { error: "Payment is not configured (missing Razorpay key id on server)" },
        { status: 503 },
      );
    }

    return NextResponse.json({
      bookingId: booking.id,
      orderId: order.id,
      amount: booking.amount_paise,
      currency: booking.currency,
      keyId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Payment setup failed" }, { status: 500 });
  }
}
