-- Idempotent: Twilio / notification flow reads this column on confirmed bookings.
alter table public.bookings
  add column if not exists notifications_sent_at timestamptz;
