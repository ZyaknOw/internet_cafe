-- Snack / pre-order tickets raised from the client portal.
-- A single row is the source of truth behind:
--   * the client "Billing & Transaction History" tab,
--   * the staff "Snack & Pre-Order Management" queue,
--   * the pending café order counters on the admin/staff overview cards.
-- The reference is database-owned, so simultaneous orders cannot reuse a code.
create sequence if not exists public.order_reference_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null default ('ORD-' || nextval('public.order_reference_seq')::text),
  customer_profile_id uuid not null references public.account_profiles(id) on delete restrict,
  customer_name text not null,
  station_key text,
  items jsonb not null default '[]'::jsonb,
  item_count integer not null default 0 check (item_count >= 0),
  total numeric(10,2) not null check (total >= 0),
  payment_method text not null default 'Member Balance',
  status text not null default 'pending' check (status in ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  notes text,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists orders_reference_key on public.orders(reference);

-- Client history reads one member's tickets newest first.
create index if not exists orders_customer_placed_idx
  on public.orders(customer_profile_id, placed_at desc);

-- The front desk queue reads open tickets newest first.
create index if not exists orders_status_placed_idx
  on public.orders(status, placed_at desc);

alter table public.orders enable row level security;
