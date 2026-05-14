-- Recovery: some DBs had every migration filename recorded without running SQL (old migrate bootstrap).
-- Safe to re-run: keeps admin@gmail.com / Admin123 in sync with app login.

update public.admin_users
set
  password_hash = '$2b$12$A/RH3P.F9vlVYJ3z9mLZzuPuhmOVrVRsSp4Gk9r6adw/dbYzjJLUq',
  display_name = coalesce(display_name, 'Admin'),
  updated_at = now()
where lower(email) = lower('admin@gmail.com');

insert into public.admin_users (email, password_hash, display_name)
select
  'admin@gmail.com',
  '$2b$12$A/RH3P.F9vlVYJ3z9mLZzuPuhmOVrVRsSp4Gk9r6adw/dbYzjJLUq',
  'Admin'
where not exists (
  select 1 from public.admin_users where lower(email) = lower('admin@gmail.com')
);
