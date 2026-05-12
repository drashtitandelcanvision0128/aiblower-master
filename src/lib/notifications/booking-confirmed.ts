import { createAdminClient } from "@/lib/supabase/admin";
import { formatInrFromPaise, formatSlotRange } from "@/lib/format";
import { indiaPhoneToE164 } from "@/lib/notifications/phone";
import { sendTwilioSms, sendTwilioWhatsApp } from "@/lib/whatsapp/twilio";

type SlotJoin = { start_at: string; end_at: string } | { start_at: string; end_at: string }[] | null;

type BookingRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  amount_paise: number;
  currency: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  notifications_sent_at: string | null;
  slots: SlotJoin;
};

function slotFromRow(row: BookingRow) {
  const s = row.slots;
  if (Array.isArray(s)) return s[0] ?? null;
  return s;
}

function buildDetailsText(row: BookingRow) {
  const slot = slotFromRow(row);
  const slotLine = slot ? formatSlotRange(slot.start_at, slot.end_at) : "Slot: (unknown)";
  const amount = formatInrFromPaise(row.amount_paise);
  return [
    `Booking ID: ${row.id}`,
    `Customer: ${row.customer_name}`,
    `Phone: ${row.customer_phone}`,
    slotLine,
    `Amount: ${amount}`,
    row.razorpay_payment_id ? `Payment: ${row.razorpay_payment_id}` : null,
    row.razorpay_order_id ? `Order: ${row.razorpay_order_id}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Idempotent: only the first successful DB claim sends notifications.
 */
export async function sendBookingConfirmedNotifications(bookingId: string) {
  const admin = createAdminClient();

  const { data: row, error: readError } = await admin
    .from("bookings")
    .select(
      `
      id,
      customer_name,
      customer_phone,
      amount_paise,
      currency,
      razorpay_payment_id,
      razorpay_order_id,
      notifications_sent_at,
      slots ( start_at, end_at )
    `,
    )
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (readError) {
    console.error("[notifications] read failed", readError);
    throw readError;
  }

  if (!row) {
    return { skipped: true as const, reason: "not_found_or_not_confirmed" as const };
  }

  const booking = row as BookingRow;
  if (booking.notifications_sent_at) {
    return { skipped: true as const, reason: "already_sent" as const };
  }

  const adminWa = process.env.ADMIN_NOTIFY_WHATSAPP_E164?.trim();
  const smsFrom = process.env.TWILIO_SMS_FROM?.trim();

  const canAdminWa =
    !!adminWa &&
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_WHATSAPP_FROM;
  let canCustomerSms = false;
  try {
    indiaPhoneToE164(booking.customer_phone);
    canCustomerSms = !!smsFrom && !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
  } catch {
    canCustomerSms = false;
  }

  if (!canAdminWa && !canCustomerSms) {
    console.warn(
      "[notifications] No delivery channels configured (admin WhatsApp or customer SMS). Skipping.",
    );
    return { skipped: true as const, reason: "no_channels" as const };
  }

  const { data: claimed, error: claimError } = await admin
    .from("bookings")
    .update({ notifications_sent_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .is("notifications_sent_at", null)
    .select(
      `
      id,
      customer_name,
      customer_phone,
      amount_paise,
      currency,
      razorpay_payment_id,
      razorpay_order_id,
      slots ( start_at, end_at )
    `,
    )
    .maybeSingle();

  if (claimError) {
    console.error("[notifications] claim failed", claimError);
    throw claimError;
  }

  if (!claimed) {
    return { skipped: true as const, reason: "claim_lost" as const };
  }

  const claimedRow = claimed as BookingRow;
  const detailsText = buildDetailsText(claimedRow);

  const tasks: Promise<void>[] = [];

  if (canAdminWa && adminWa) {
    tasks.push(
      sendTwilioWhatsApp({
        toE164: adminWa,
        body: `New AIbowler booking (paid)\n\n${detailsText}`,
      }).catch((e) => {
        console.error("[notifications] admin WhatsApp failed", e);
      }),
    );
  }

  if (canCustomerSms) {
    try {
      const to = indiaPhoneToE164(claimedRow.customer_phone);
      tasks.push(
        sendTwilioSms({
          toE164: to,
          body: `AIbowler: Your booking is confirmed. ${detailsText.replace(/\n/g, " | ")}`,
        }).catch((e) => {
          console.error("[notifications] customer SMS failed", e);
        }),
      );
    } catch (e) {
      console.error("[notifications] customer SMS skipped", e);
    }
  }

  await Promise.all(tasks);

  return { skipped: false as const };
}
