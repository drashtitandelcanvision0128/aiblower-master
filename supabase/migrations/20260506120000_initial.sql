-- AIbowler: slots, bookings, admin_users, RLS, confirmation RPC

create extension if not exists "pgcrypto";

create type public.booking_status as enum (
  'pending_payment',
  'confirmed',
  'cancelled',
  'expired'
);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  price_paise integer not null default 30000 check (price_paise > 0),
  capacity integer not null default 1 check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint slots_end_after_start check (end_at > start_at)
);

create unique index slots_start_at_key on public.slots (start_at);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  status public.booking_status not null default 'pending_payment',
  razorpay_order_id text,
  razorpay_payment_id text,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_slot_id_idx on public.bookings (slot_id);
create index bookings_status_idx on public.bookings (status);
create index bookings_phone_idx on public.bookings (customer_phone);
create index bookings_order_id_idx on public.bookings (razorpay_order_id);

create unique index bookings_one_confirmed_per_slot
  on public.bookings (slot_id)
  where status = 'confirmed';

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row
  execute procedure public.set_updated_at();

-- Atomically confirm payment if slot still free
create or replace function public.confirm_booking_payment(p_order_id text, p_payment_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.bookings b
  set
    status = 'confirmed',
    razorpay_payment_id = p_payment_id,
    updated_at = now()
  where b.razorpay_order_id = p_order_id
    and b.status = 'pending_payment'
    and not exists (
      select 1
      from public.bookings b2
      where b2.slot_id = b.slot_id
        and b2.status = 'confirmed'
    )
  returning b.id into v_id;

  return v_id;
end;
$$;

revoke all on function public.confirm_booking_payment(text, text) from public;
grant execute on function public.confirm_booking_payment(text, text) to service_role;

-- RLS
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.admin_users enable row level security;

create policy admin_users_self_read
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

create policy admin_slots_select
  on public.slots
  for select
  to authenticated
  using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

create policy admin_slots_update
  on public.slots
  for update
  to authenticated
  using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

create policy admin_bookings_select
  on public.bookings
  for select
  to authenticated
  using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

create policy admin_bookings_update
  on public.bookings
  for update
  to authenticated
  using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

-- Seed slots: two 30-minute evening windows (8:00 PM, 8:30 PM) for next 14 days
insert into public.slots (start_at, end_at, price_paise)
select
  (d.day::timestamp + t.start_time) at time zone 'Asia/Kolkata',
  (d.day::timestamp + t.start_time + interval '30 minutes') at time zone 'Asia/Kolkata',
  30000
from (
  select generate_series(current_date, current_date + interval '14 days', interval '1 day') as day
) d
cross join (
  values (time '20:00'), (time '20:30')
) as t(start_time)
where not exists (select 1 from public.slots limit 1);
