import { z } from "zod";

export const initiateBookingSchema = z.object({
  slotId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
});

export const verifyPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

export const adminBookingPatchSchema = z.object({
  customerName: z.string().trim().min(2).max(120).optional(),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
    .optional(),
  slotId: z.string().uuid().optional(),
  status: z.enum(["pending_payment", "confirmed", "cancelled", "expired"]).optional(),
});
