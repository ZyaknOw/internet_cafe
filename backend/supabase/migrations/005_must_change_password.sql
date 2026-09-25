-- Adds must_change_password flag to account_profiles.
-- Used by the admin approval workflow to force new users to set a personal
-- password after receiving a system-generated temporary password.
alter table public.account_profiles
  add column if not exists must_change_password boolean not null default false;
