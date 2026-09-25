-- Public-facing NetCafe ID for every administrator, staff member, and customer.
-- The sequence is database-owned, so simultaneous account creation cannot reuse an ID.
create sequence if not exists public.account_profile_user_code_seq;

alter table public.account_profiles
  add column if not exists user_code text;

alter table public.account_profiles
  alter column user_code set default (
    'NC-' || lpad(nextval('public.account_profile_user_code_seq')::text, 6, '0')
  );

-- Give existing records a code before making the field required.
update public.account_profiles
  set user_code = default
  where user_code is null;

alter table public.account_profiles
  alter column user_code set not null;

create unique index if not exists account_profiles_user_code_key
  on public.account_profiles(user_code);
