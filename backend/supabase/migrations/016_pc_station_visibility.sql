-- Keep the original eight PCs visible by default. Older station rows beyond
-- PC-08 are preserved and can be re-enabled from Admin when needed.
alter table public.stations
  add column if not exists is_enabled boolean not null default true;

update public.stations
set is_enabled = (
  regexp_replace(name, '^PC[ -]*0*([1-9][0-9]*).*$', '\1', 'i')::integer <= 8
)
where name ~* '^PC[ -]*0*[1-9][0-9]*';
