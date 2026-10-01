-- Keep the original start timestamp while excluding cancelled billing pauses.
alter table public.station_sessions
  add column if not exists billing_paused_ms bigint not null default 0
  check (billing_paused_ms >= 0);
