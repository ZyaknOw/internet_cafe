-- A station may have one waiting or active registered-customer session at a time.
create table if not exists public.station_sessions (
  id uuid primary key default gen_random_uuid(),
  station_key text not null,
  station_name text not null,
  customer_profile_id uuid not null references public.account_profiles(id) on delete restrict,
  customer_name text not null,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  status text not null default 'pending_client' check (status in ('pending_client', 'active', 'ended', 'cancelled')),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  total numeric(10,2),
  created_by_profile_id uuid references public.account_profiles(id) on delete set null
);

create unique index if not exists station_sessions_one_open_per_station
  on public.station_sessions(station_key)
  where status in ('pending_client', 'active');

create index if not exists station_sessions_customer_open_idx
  on public.station_sessions(customer_profile_id, status);

alter table public.station_sessions enable row level security;
