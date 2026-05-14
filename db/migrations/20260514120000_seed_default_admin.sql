-- Default admin for first deploy only if no row exists for this email.
-- Login: admin@gmail.com / Admin123 — change password from /admin after first login.

insert into public.admin_users (email, password_hash, display_name)
select
  'admin@gmail.com',
  '$2b$12$A/RH3P.F9vlVYJ3z9mLZzuPuhmOVrVRsSp4Gk9r6adw/dbYzjJLUq',
  'Admin'
where not exists (
  select 1 from public.admin_users where lower(email) = lower('admin@gmail.com')
);
