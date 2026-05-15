export const BOOKING_TYPES = ["tennis_ball", "leather_ball"] as const;

export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  tennis_ball: "Tennis Ball Booking",
  leather_ball: "Leather Ball Booking",
};

/** Price in paise (INR × 100). */
export const BOOKING_TYPE_PRICE_PAISE: Record<BookingType, number> = {
  tennis_ball: 30000,
  leather_ball: 50000,
};

export function getBookingPricePaise(type: BookingType): number {
  return BOOKING_TYPE_PRICE_PAISE[type];
}

export function isBookingType(value: string): value is BookingType {
  return (BOOKING_TYPES as readonly string[]).includes(value);
}

/** IST calendar date (YYYY-MM-DD) from a slot start timestamp. */
export function bookingDateFromSlotStart(startAt: Date | string): string {
  return new Date(startAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Saturday/Sunday in Asia/Kolkata. */
export function isWeekendDateKey(dateKey: string): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00+05:30`));
  return weekday === "Sat" || weekday === "Sun";
}
