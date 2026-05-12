import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();

  const { data: booking, error: readError } = await admin
    .from("bookings")
    .select("id, razorpay_order_id, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (readError) {
    console.error("[verify-payment] booking read", readError);
    return NextResponse.json({ error: "Could not load booking" }, { status: 500 });
  }

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

  const { data: confirmedId, error: rpcError } = await admin.rpc("confirm_booking_payment", {
    p_order_id: razorpay_order_id,
    p_payment_id: razorpay_payment_id,
  });

  if (rpcError) {
    console.error("[verify-payment] confirm_booking_payment", rpcError);
    return NextResponse.json({ error: "Could not confirm booking" }, { status: 500 });
  }

  if (!confirmedId) {
    const { data: again } = await admin
      .from("bookings")
      .select("id, status")
      .eq("id", bookingId)
      .maybeSingle();

    if (again?.status === "confirmed") {
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
