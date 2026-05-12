import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingConfirmedNotifications } from "@/lib/notifications/booking-confirmed";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    order?: { entity?: { id?: string } };
  };
};

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    console.error(
      JSON.stringify({ scope: "razorpay_webhook", ok: false, reason: "missing_x_razorpay_signature" }),
    );
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const signatureValid = safeEqual(expected, signature);
  if (!signatureValid) {
    console.error(
      JSON.stringify({
        scope: "razorpay_webhook",
        ok: false,
        reason: "invalid_signature",
        hint: "check RAZORPAY_WEBHOOK_SECRET matches Razorpay dashboard webhook secret",
      }),
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event;
  const paymentEntity = body.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id;
  const paymentId = paymentEntity?.id;

  console.log(
    JSON.stringify({
      scope: "razorpay_webhook",
      event: event ?? null,
      hasPaymentEntity: Boolean(paymentEntity),
      orderId: orderId ?? null,
      paymentId: paymentId ?? null,
    }),
  );

  if (event === "payment.captured" && orderId && paymentId) {
    const admin = createAdminClient();
    const { data: bookingId, error } = await admin.rpc("confirm_booking_payment", {
      p_order_id: orderId,
      p_payment_id: paymentId,
    });

    if (error) {
      console.error(
        JSON.stringify({
          scope: "razorpay_webhook_confirm",
          event,
          ok: false,
          rpcError: error.message,
        }),
        error,
      );
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    if (!bookingId) {
      console.log(
        JSON.stringify({
          scope: "razorpay_webhook_confirm",
          event,
          ok: true,
          note: "not_applied",
          reason: "no_row_updated_pending_payment_or_slot_taken",
          orderId,
          paymentId,
        }),
      );
      return NextResponse.json({ ok: true, note: "not_applied" });
    }

    console.log(
      JSON.stringify({
        scope: "razorpay_webhook_confirm",
        event,
        ok: true,
        bookingId: String(bookingId),
      }),
    );

    try {
      await sendBookingConfirmedNotifications(String(bookingId));
    } catch (notifyErr) {
      console.error("[notifications] after payment.captured", notifyErr);
    }

    return NextResponse.json({ ok: true, bookingId });
  }

  console.log(
    JSON.stringify({
      scope: "razorpay_webhook",
      ok: true,
      ignored: event ?? "unknown",
      note: event === "payment.captured" ? "missing_order_or_payment_in_payload" : "event_not_handled",
    }),
  );
  return NextResponse.json({ ok: true, ignored: event ?? "unknown" });
}
