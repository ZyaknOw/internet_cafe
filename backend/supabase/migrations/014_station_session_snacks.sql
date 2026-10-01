-- Snacks are part of the existing session payment, not a separate order/payment.
alter table public.station_sessions
  add column if not exists snack_items jsonb not null default '[]'::jsonb,
  add column if not exists snack_total numeric(10,2) not null default 0;
