-- Preserve the existing station-session payment record while retaining the
-- selected payment method and cash tender details for transaction history.
alter table public.station_sessions
  add column if not exists payment_method text check (payment_method in ('cash', 'wallet')),
  add column if not exists cash_received numeric(10,2),
  add column if not exists change_due numeric(10,2);