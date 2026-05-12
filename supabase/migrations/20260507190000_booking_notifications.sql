-- Optional customer email + idempotent notification marker
alter table public.bookings
  add column if not exists customer_email text,
  add column if not exists notifications_sent_at timestamptz;

comment on column public.bookings.customer_email is 'Optional; used for booking confirmation email.';
comment on column public.bookings.notifications_sent_at is 'Set after post-payment notifications are dispatched (idempotency).';
