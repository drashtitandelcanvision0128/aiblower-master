import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { getRazorpay } from "@/lib/razorpay";
import { sendBookingConfirmedNotifications } from "@/lib/notifications/booking-confirmed";
import { verifyPaymentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function cleanEnv(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.replace(/^['"]+|['"]+$/g, "");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const keySecret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);
  if (!keySecret) return false;
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

type RazorpayPaymentEntity = { status?: string; order_id?: string | null };

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = verifyPaymentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  let razorpay;
  try {
    razorpay = getRazorpay();
  } catch (e) {
    console.error("[verify-payment] razorpay config", e);
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  try {
    const payment = (await razorpay.payments.fetch(razorpay_payment_id)) as RazorpayPaymentEntity;
    if (payment.status !== "captured") {
      return NextResponse.json(
        { error: `Payment is not captured (status: ${payment.status ?? "unknown"})` },
        { status: 400 },
      );
    }
    if (payment.order_id && payment.order_id !== razorpay_order_id) {
      return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
    }
  } catch (e) {
    console.error("[verify-payment] payments.fetch", e);
    return NextResponse.json({ error: "Could not verify payment with Razorpay" }, { status: 502 });
  }

  const pool = getPool();

  const { rows: bookingRows } = await pool.query<{
    id: string;
    razorpay_order_id: string | null;
    status: string;
  }>(`SELECT id, razorpay_order_id, status::text AS status FROM bookings WHERE id = $1 LIMIT 1`, [bookingId]);

  const booking = bookingRows[0];
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Order does not match this booking" }, { status: 403 });
  }

  if (booking.status === "confirmed") {
    return NextResponse.json({ ok: true, bookingId, alreadyConfirmed: true });
  }

  if (booking.status !== "pending_payment") {
    return NextResponse.json(
      { error: `Booking cannot be confirmed from status: ${booking.status}` },
      { status: 409 },
    );
  }

  const { rows: confirmRows } = await pool.query<{ booking_id: string | null }>(
    `SELECT confirm_booking_payment($1::text, $2::text) AS booking_id`,
    [razorpay_order_id, razorpay_payment_id],
  );

  const confirmedId = confirmRows[0]?.booking_id;

  if (!confirmedId) {
    const { rows: again } = await pool.query<{ status: string }>(
      `SELECT status::text AS status FROM bookings WHERE id = $1 LIMIT 1`,
      [bookingId],
    );

    if (again[0]?.status === "confirmed") {
      return NextResponse.json({ ok: true, bookingId, alreadyConfirmed: true });
    }

    return NextResponse.json(
      { error: "Could not confirm — the slot may already be taken. Contact support if you were charged." },
      { status: 409 },
    );
  }

  const id = String(confirmedId);
  try {
    await sendBookingConfirmedNotifications(id);
  } catch (notifyErr) {
    console.error("[verify-payment] notifications", notifyErr);
  }

  return NextResponse.json({ ok: true, bookingId: id });
}
