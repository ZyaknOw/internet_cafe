begin;

-- Store the audit trail on the existing session; never create another bill.
alter table public.station_sessions
  add column if not exists transfer_history jsonb not null default '[]'::jsonb;

-- Legacy callers use both PC-01 and PC-1 (and sometimes a display suffix).
create or replace function public.station_identity(value text)
returns text language sql immutable strict set search_path = public
as $$
  select regexp_replace(upper(trim(value)), '^PC[ -]*0*([1-9][0-9]*)( .*)?$', 'PC-\1');
$$;

-- Also protect against a concurrent ordinary session assignment after transfer.
create unique index if not exists station_sessions_one_open_per_identity
  on public.station_sessions (public.station_identity(station_key))
  where status in ('pending_client', 'active', 'awaiting_payment');

create or replace function public.transfer_station_session(
  p_session_id uuid, p_destination_id text, p_expected_station text, p_actor_id uuid
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  current_session public.station_sessions%rowtype;
  destination public.stations%rowtype;
begin
  -- Serialize with assignments, checkout and payment writes. At cafe scale this
  -- short transaction avoids check-then-update races and cross-transfer deadlocks.
  lock table public.station_sessions in share row exclusive mode;
  select * into current_session from public.station_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  if current_session.status <> 'active' or current_session.started_at is null then
    raise exception 'Only an active session can be transferred.' using errcode = 'P0001';
  end if;
  if public.station_identity(current_session.station_key) <> public.station_identity(p_expected_station)
     and public.station_identity(current_session.station_name) <> public.station_identity(p_expected_station) then
    raise exception 'This session has moved. Refresh and try again.' using errcode = 'P0001';
  end if;
  select * into destination from public.stations where id::text = p_destination_id for update;
  if not found then
    raise exception 'Destination PC not found.' using errcode = 'P0002';
  end if;
  if public.station_identity(destination.name) in (
    public.station_identity(current_session.station_key), public.station_identity(current_session.station_name)
  ) then
    raise exception 'Choose a different PC.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.station_sessions
    where status in ('pending_client', 'active', 'awaiting_payment')
      and public.station_identity(destination.name) in (
        public.station_identity(station_key), public.station_identity(station_name)
      )
  ) then
    raise exception 'This PC is no longer available.' using errcode = 'P0001';
  end if;
  if destination.status::text not in ('available', 'in_use') then
    raise exception 'This PC is not available for use.' using errcode = 'P0001';
  end if;

  update public.stations set status = 'available'
    where public.station_identity(name) in (
      public.station_identity(current_session.station_key), public.station_identity(current_session.station_name)
    );
  update public.stations set status = 'in_use' where id = destination.id;
  update public.station_sessions
  set station_key = destination.name,
      station_name = destination.name,
      transfer_history = transfer_history || jsonb_build_array(jsonb_build_object(
        'from_station_key', current_session.station_key,
        'from_station_name', current_session.station_name,
        'to_station_id', destination.id,
        'to_station_name', destination.name,
        'transferred_at', clock_timestamp(),
        'staff_profile_id', p_actor_id
      ))
  where id = p_session_id
  returning * into current_session;
  return to_jsonb(current_session);
end;
$$;

revoke all on function public.transfer_station_session(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.transfer_station_session(uuid, text, text, uuid) to service_role;

commit;
