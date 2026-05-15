import { BOOKING_TYPE_LABELS, type BookingType } from "@/lib/booking-types";
import { formatInrFromPaise, formatSlotRange } from "@/lib/format";
import { getPool } from "@/lib/db/pool";
import { indiaPhoneToE164 } from "@/lib/notifications/phone";
import { sendTwilioSms, sendTwilioWhatsApp } from "@/lib/whatsapp/twilio";

type BookingRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  amount_paise: number;
  currency: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  notifications_sent_at: Date | null;
  booking_type: string;
  booking_date: Date;
  start_at: Date | null;
  end_at: Date | null;
};

function buildDetailsText(row: BookingRow) {
  const slotLine =
    row.start_at && row.end_at
      ? formatSlotRange(row.start_at.toISOString(), row.end_at.toISOString())
      : "Slot: (unknown)";
  const amount = formatInrFromPaise(row.amount_paise);
  const typeLabel = BOOKING_TYPE_LABELS[row.booking_type as BookingType] ?? row.booking_type;
  const dateLabel = row.booking_date.toISOString().slice(0, 10);
  return [
    `Booking ID: ${row.id}`,
    `Customer: ${row.customer_name}`,
    `Phone: ${row.customer_phone}`,
    `Type: ${typeLabel}`,
    `Date: ${dateLabel}`,
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
  const pool = getPool();

  const { rows: readRows } = await pool.query<BookingRow>(
    `
    SELECT
      b.id,
      b.customer_name,
      b.customer_phone,
      b.amount_paise,
      b.currency,
      b.razorpay_payment_id,
      b.razorpay_order_id,
      b.notifications_sent_at,
      b.booking_type::text AS booking_type,
      b.booking_date,
      s.start_at,
      s.end_at
    FROM bookings b
    JOIN slots s ON s.id = b.slot_id
    WHERE b.id = $1 AND b.status = 'confirmed'
    LIMIT 1
    `,
    [bookingId],
  );

  const row = readRows[0];
  if (!row) {
    return { skipped: true as const, reason: "not_found_or_not_confirmed" as const };
  }

  if (row.notifications_sent_at) {
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
    indiaPhoneToE164(row.customer_phone);
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

  const { rows: claimedRows } = await pool.query<BookingRow>(
    `
    UPDATE bookings b
    SET notifications_sent_at = now(), updated_at = now()
    FROM slots s
    WHERE b.id = $1
      AND b.slot_id = s.id
      AND b.status = 'confirmed'
      AND b.notifications_sent_at IS NULL
    RETURNING
      b.id,
      b.customer_name,
      b.customer_phone,
      b.amount_paise,
      b.currency,
      b.razorpay_payment_id,
      b.razorpay_order_id,
      b.booking_type::text AS booking_type,
      b.booking_date,
      s.start_at,
      s.end_at
    `,
    [bookingId],
  );

  const claimed = claimedRows[0];
  if (!claimed) {
    return { skipped: true as const, reason: "claim_lost" as const };
  }

  const detailsText = buildDetailsText(claimed);

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
      const to = indiaPhoneToE164(claimed.customer_phone);
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
