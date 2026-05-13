-- Update existing projects to 30-minute evening slots at INR 300.
-- Active bookable slots: 8:00 PM and 8:30 PM IST (next 30 days).

-- Deactivate future active slots from previous setup.
update public.slots
set is_active = false
where is_active = true
  and start_at >= now();

-- Create or update the two daily slots.
insert into public.slots (start_at, end_at, price_paise, capacity, is_active)
select
  (d.day::timestamp + t.start_time) at time zone 'Asia/Kolkata' as start_at,
  (d.day::timestamp + t.start_time + interval '30 minutes') at time zone 'Asia/Kolkata' as end_at,
  30000 as price_paise,
  1 as capacity,
  true as is_active
from (
  select generate_series(current_date, current_date + interval '30 days', interval '1 day') as day
) d
cross join (
  values (time '20:00'), (time '20:30')
) as t(start_time)
on conflict (start_at) do update
set
  end_at = excluded.end_at,
  price_paise = excluded.price_paise,
  capacity = excluded.capacity,
  is_active = true;

