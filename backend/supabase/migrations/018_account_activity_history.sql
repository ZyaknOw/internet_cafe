-- Run in Supabase SQL Editor before deploying the account-history API changes.
begin;

alter table public.account_profiles
  add column if not exists last_modified_by_profile_id uuid
  references public.account_profiles(id) on delete set null;

create table if not exists public.account_activity_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_profile_id uuid references public.account_profiles(id) on delete set null,
  actor_name text not null,
  actor_role text,
  target_profile_id uuid not null,
  target_name text not null,
  target_role text not null,
  action text not null check (action in (
    'account.created', 'account.approved', 'account.rejected',
    'account.updated', 'account.deleted', 'account.password_setup_completed'
  )),
  details jsonb not null default '{}'::jsonb,
  event_key text unique
);
create index if not exists account_activity_log_time_idx
  on public.account_activity_log (occurred_at desc, id desc);
alter table public.account_activity_log enable row level security;
revoke all on public.account_activity_log from public, anon, authenticated, service_role;
grant select on public.account_activity_log to service_role;

create or replace function public.record_account_activity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  row_data jsonb;
  old_data jsonb;
  actor_id uuid;
  actor_label text;
  actor_kind text;
  action_name text;
  changes jsonb := '[]'::jsonb;
begin
  if TG_OP = 'DELETE' then
    row_data := to_jsonb(OLD);
    action_name := 'account.deleted';
    actor_id := OLD.last_modified_by_profile_id;
  elsif TG_OP = 'INSERT' then
    row_data := to_jsonb(NEW);
    action_name := 'account.created';
    actor_id := NEW.created_by_profile_id;
  else
    row_data := to_jsonb(NEW);
    old_data := to_jsonb(OLD);
    select coalesce(jsonb_agg(key order by key), '[]'::jsonb) into changes
      from jsonb_each(row_data)
      where key = any(array['first_name','middle_name','last_name','suffix','email',
        'contact','address','role','status','avatar_url','date_of_birth','gender',
        'emergency_contact','must_change_password'])
      and value is distinct from old_data -> key;
    if changes = '[]'::jsonb then return NEW; end if;
    actor_id := NEW.last_modified_by_profile_id;
    action_name := case
      when OLD.status = 'pending' and NEW.status in ('approved','active') then 'account.approved'
      when OLD.status is distinct from NEW.status and NEW.status = 'rejected' then 'account.rejected'
      when coalesce((old_data ->> 'must_change_password')::boolean, false)
        and not coalesce((row_data ->> 'must_change_password')::boolean, false)
        then 'account.password_setup_completed'
      else 'account.updated' end;
  end if;

  select trim(concat_ws(' ', first_name, last_name)), role into actor_label, actor_kind
    from public.account_profiles where id = actor_id;
  insert into public.account_activity_log (
    actor_profile_id, actor_name, actor_role, target_profile_id, target_name,
    target_role, action, details
  ) values (
    actor_id, coalesce(nullif(actor_label, ''),
      case when TG_OP = 'INSERT' and actor_id is null then 'Self registration' else 'System / not recorded' end),
    actor_kind, (row_data ->> 'id')::uuid,
    trim(concat_ws(' ', row_data ->> 'first_name', row_data ->> 'last_name')),
    row_data ->> 'role', action_name,
    jsonb_build_object('changed_fields', changes, 'previous_status', old_data ->> 'status',
      'status', row_data ->> 'status')
  );
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;
revoke all on function public.record_account_activity() from public, anon, authenticated;
drop trigger if exists account_activity_capture on public.account_profiles;
create trigger account_activity_capture after insert or update or delete
  on public.account_profiles for each row execute function public.record_account_activity();

-- Recover only approvals whose original approver and time were actually stored.
-- This is not a reconstruction of unrecorded historical edits or rejections.
insert into public.account_activity_log (
  occurred_at, actor_profile_id, actor_name, actor_role, target_profile_id,
  target_name, target_role, action, details, event_key
)
select p.approved_at, a.id, coalesce(nullif(trim(concat_ws(' ', a.first_name, a.last_name)), ''), 'Not recorded'),
  a.role, p.id, trim(concat_ws(' ', p.first_name, p.last_name)), p.role, 'account.approved',
  jsonb_build_object('source', 'stored_approval', 'status', p.status),
  'stored-approval:' || p.id::text || ':' || p.approved_at::text
from public.account_profiles p left join public.account_profiles a on a.id = p.approved_by_profile_id
where p.approved_at is not null
  and not exists (select 1 from public.account_activity_log h
    where h.target_profile_id = p.id and h.action = 'account.approved')
on conflict (event_key) do nothing;
commit;
