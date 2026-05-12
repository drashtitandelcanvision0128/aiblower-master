import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const admin = createAdminClient();

    const cutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
    await admin
      .from("bookings")
      .update({ status: "expired" })
      .eq("status", "pending_payment")
      .lt("created_at", cutoff);

    const { data: slot, error: slotError } = await admin
      .from("slots")
      .select("id, start_at, end_at, price_paise, capacity, is_active")
      .eq("id", slotId)
      .maybeSingle();

    if (slotError || !slot || !slot.is_active) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    if (new Date(slot.start_at) <= new Date()) {
      return NextResponse.json({ error: "Slot is no longer available" }, { status: 400 });
    }

    const { count: confirmedCount, error: countError } = await admin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("slot_id", slotId)
      .eq("status", "confirmed");

    if (countError) {
      console.error(countError);
      return NextResponse.json({ error: "Could not verify slot" }, { status: 500 });
    }

    if ((confirmedCount ?? 0) >= slot.capacity) {
      return NextResponse.json({ error: "This slot is already booked" }, { status: 409 });
    }

    const { data: booking, error: insertError } = await admin
      .from("bookings")
      .insert({
        slot_id: slotId,
        customer_name: customerName,
        customer_phone: customerPhone,
        status: "pending_payment",
        amount_paise: slot.price_paise,
        currency: "INR",
      })
      .select("id, amount_paise, currency")
      .single();

    if (insertError || !booking) {
      console.error(insertError);
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

    const { error: orderUpdateError } = await admin
      .from("bookings")
      .update({ razorpay_order_id: order.id })
      .eq("id", booking.id);

    if (orderUpdateError) {
      console.error(orderUpdateError);
      return NextResponse.json({ error: "Could not link payment order" }, { status: 500 });
    }

    return NextResponse.json({
      bookingId: booking.id,
      orderId: order.id,
      amount: booking.amount_paise,
      currency: booking.currency,
      keyId: cleanEnv(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Payment setup failed" }, { status: 500 });
  }
}
