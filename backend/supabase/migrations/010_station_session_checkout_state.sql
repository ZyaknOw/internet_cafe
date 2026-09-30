-- Freeze a station session when staff sends it to Billing. Payment remains
-- separate: awaiting_payment sessions are not paid until the payment endpoint
-- confirms successfully.
alter table public.station_sessions
  add column if not exists checkout_at timestamptz,
  add column if not exists checkout_duration_seconds integer,
  add column if not exists checkout_total numeric(10,2);

alter table public.station_sessions drop constraint if exists station_sessions_status_check;
alter table public.station_sessions
  add constraint station_sessions_status_check
  check (status in ('pending_client', 'active', 'awaiting_payment', 'ended', 'cancelled'));

-- A station remains occupied while its frozen checkout is awaiting payment.
drop index if exists public.station_sessions_one_open_per_station;
create unique index if not exists station_sessions_one_open_per_station
  on public.station_sessions(station_key)
  where status in ('pending_client', 'active', 'awaiting_payment');

create index if not exists station_sessions_checkout_idx
  on public.station_sessions(status, checkout_at);
