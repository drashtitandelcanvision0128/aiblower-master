import { z } from "zod";
import { BOOKING_TYPES } from "@/lib/booking-types";

export const initiateBookingSchema = z.object({
  slotId: z.string().uuid(),
  bookingType: z.enum(BOOKING_TYPES),
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

export const adminProfilePatchSchema = z
  .object({
    displayName: z.string().trim().max(200).optional(),
    email: z.string().trim().email().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6).optional(),
    newPasswordConfirm: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword) {
      if (!data.currentPassword) {
        ctx.addIssue({
          code: "custom",
          message: "currentPassword is required to set a new password",
          path: ["currentPassword"],
        });
      }
      if (data.newPassword !== data.newPasswordConfirm) {
        ctx.addIssue({
          code: "custom",
          message: "newPassword and newPasswordConfirm must match",
          path: ["newPasswordConfirm"],
        });
      }
    }
  });
