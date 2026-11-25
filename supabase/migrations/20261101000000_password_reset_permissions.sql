create table if not exists public.password_reset_permissions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  granted_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists password_reset_permissions_email_idx
  on public.password_reset_permissions (email);

alter table public.password_reset_permissions enable row level security;

revoke all on table public.password_reset_permissions from anon, authenticated;
grant all on table public.password_reset_permissions to service_role;
