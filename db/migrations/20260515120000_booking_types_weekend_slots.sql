-- Booking ball types, booking_date on reservations, weekday vs weekend slot windows.

create type public.booking_ball_type as enum ('tennis_ball', 'leather_ball');

alter table public.bookings
  add column if not exists booking_type public.booking_ball_type,
  add column if not exists booking_date date;

update public.bookings b
set
  booking_type = coalesce(b.booking_type, 'tennis_ball'::public.booking_ball_type),
  booking_date = coalesce(
    b.booking_date,
    (s.start_at at time zone 'Asia/Kolkata')::date
  )
from public.slots s
where s.id = b.slot_id
  and (b.booking_type is null or b.booking_date is null);

alter table public.bookings
  alter column booking_type set not null,
  alter column booking_date set not null;

create index if not exists bookings_booking_date_idx on public.bookings (booking_date);

-- Replace future active slots: weekdays 8–9 PM IST; weekends 8 AM–9 PM IST (30 min each).
update public.slots
set is_active = false
where is_active = true
  and start_at >= now();

-- Weekdays (Mon–Fri): 8:00 PM and 8:30 PM
insert into public.slots (start_at, end_at, price_paise, capacity, is_active)
select
  (d.day::timestamp + t.start_time) at time zone 'Asia/Kolkata',
  (d.day::timestamp + t.start_time + interval '30 minutes') at time zone 'Asia/Kolkata',
  30000,
  1,
  true
from (
  select generate_series(current_date, current_date + interval '60 days', interval '1 day')::date as day
) d
cross join (
  values (time '20:00'), (time '20:30')
) as t(start_time)
where extract(dow from d.day) between 1 and 5
on conflict (start_at) do update
set
  end_at = excluded.end_at,
  price_paise = excluded.price_paise,
  capacity = excluded.capacity,
  is_active = true;

-- Weekends (Sat–Sun): every 30 minutes from 8:00 AM through 8:30 PM (ends 9:00 PM)
insert into public.slots (start_at, end_at, price_paise, capacity, is_active)
select
  (d.day::timestamp + t.start_time) at time zone 'Asia/Kolkata',
  (d.day::timestamp + t.start_time + interval '30 minutes') at time zone 'Asia/Kolkata',
  30000,
  1,
  true
from (
  select generate_series(current_date, current_date + interval '60 days', interval '1 day')::date as day
) d
cross join (
  select (time '08:00' + (n * interval '30 minutes'))::time as start_time
  from generate_series(0, 25) as n
) t
where extract(dow from d.day) in (0, 6)
on conflict (start_at) do update
set
  end_at = excluded.end_at,
  price_paise = excluded.price_paise,
  capacity = excluded.capacity,
  is_active = true;
