-- Password reset tokens table for EV Charging Station
-- Run this in Supabase SQL editor or add as a migration.

-- 1. Table
create table if not exists public.password_reset_tokens (
  id bigserial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

-- 2. Indexes
create index if not exists idx_password_reset_user_id on public.password_reset_tokens(user_id);
create index if not exists idx_password_reset_expires_at on public.password_reset_tokens(expires_at);

-- 3. (Optional) Enable Row Level Security (RLS)
alter table public.password_reset_tokens enable row level security;

-- 4. Policies
-- Drop existing policy first (CREATE POLICY lacks IF NOT EXISTS in your PG version)
drop policy if exists "service role full access password reset" on public.password_reset_tokens;
create policy "service role full access password reset" on public.password_reset_tokens
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- (Optional) Allow a logged-in user to see only their own (usually not needed)
-- drop policy if exists "user can view own reset tokens" on public.password_reset_tokens;
-- create policy "user can view own reset tokens" on public.password_reset_tokens
--   for select using (auth.uid()::text = user_id::text);

-- 5. Housekeeping: remove expired/used tokens periodically (manual example)
-- delete from public.password_reset_tokens where (used_at is not null) or (expires_at < now());

-- Done.
