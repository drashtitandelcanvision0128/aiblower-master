/** Pending checkout holds a slot for this long (must match initiate route). */
export const PENDING_BOOKING_TTL_MS = 30 * 60 * 1000;

export function pendingBookingCutoffIso(nowMs = Date.now()): string {
  return new Date(nowMs - PENDING_BOOKING_TTL_MS).toISOString();
}
