-- Safe upgrade for projects that already have a legacy public.profiles table.
create table if not exists public.account_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  address text not null,
  contact text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'staff', 'customer')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'active', 'rejected')),
  created_by_profile_id uuid references public.account_profiles(id) on delete set null,
  approved_by_profile_id uuid references public.account_profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists account_profiles_status_idx on public.account_profiles(status);
create index if not exists account_profiles_auth_user_idx on public.account_profiles(auth_user_id);
alter table public.account_profiles enable row level security;
create policy "account_profiles_read_own" on public.account_profiles for select to authenticated using (auth_user_id = auth.uid());
