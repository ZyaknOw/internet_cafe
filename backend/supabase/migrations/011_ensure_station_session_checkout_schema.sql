-- Run this migration in the Supabase SQL Editor if migration 010 was not
-- applied to the live database. It is intentionally idempotent.
-- `ended_at` is retained for the final paid session end; `checkout_at` is the
-- separate immutable timestamp used while payment is still pending.
alter table public.station_sessions
  add column if not exists checkout_at timestamptz null,
  add column if not exists checkout_duration_seconds integer null,
  add column if not exists checkout_total numeric(10,2) null,
  add column if not exists payment_method text null,
  add column if not exists cash_received numeric(10,2) null,
  add column if not exists change_due numeric(10,2) null;

alter table public.station_sessions drop constraint if exists station_sessions_status_check;
alter table public.station_sessions
  add constraint station_sessions_status_check
  check (status in ('pending_client', 'active', 'awaiting_payment', 'ended', 'cancelled'));

drop index if exists public.station_sessions_one_open_per_station;
create unique index if not exists station_sessions_one_open_per_station
  on public.station_sessions(station_key)
  where status in ('pending_client', 'active', 'awaiting_payment');

create index if not exists station_sessions_checkout_idx
  on public.station_sessions(status, checkout_at);
