-- An approved password reset now also needs a one-time code that the
-- administrator hands to the account owner. Without it, anyone who knew an
-- approved email address could set that account's password.
alter table public.password_reset_permissions
  add column if not exists code_hash text,
  add column if not exists failed_attempts integer not null default 0;

-- Approvals granted before codes existed cannot be used safely.
delete from public.password_reset_permissions where code_hash is null;
