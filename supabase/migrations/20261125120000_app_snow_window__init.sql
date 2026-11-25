-- app_snow_window: Snow Window, a public ski-trip availability board.
-- No sign-in (documented exception, see the sandbox's apps/snow_window/APP.md):
-- the tables stay gated like every sandbox table, and anonymous visitors reach
-- them only through the security-definer functions below. They enforce the
-- guardrails, mirrored in src/lib/rules.ts: at most 20 people, names up to 24
-- characters, days inside the season, and an edit needs the row's token.

create schema app_snow_window;
grant usage on schema app_snow_window to anon, authenticated, service_role;
alter default privileges in schema app_snow_window grant all on tables to service_role;
-- Functions are not executable by anyone unless granted below.
alter default privileges in schema app_snow_window revoke execute on functions from public;

insert into platform.apps (slug, name, join_mode, redirect_urls)
values ('snow_window', 'Snow Window', 'invite',
        array['https://juholyde.github.io/snow-window/', 'http://localhost:5191/']::text[]);

create table app_snow_window.people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 24),
  emoji text not null check (char_length(emoji) between 1 and 16),
  -- Returned only once, to the creator (add_person); every edit must carry it.
  token uuid not null default gen_random_uuid(),
  days date[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table app_snow_window.people enable row level security;
-- No policies for anon or authenticated: direct table access is denied.

create function app_snow_window.get_board()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'emoji', p.emoji,
    'days', to_jsonb(p.days)) order by p.created_at), '[]'::jsonb)
  from app_snow_window.people p;
$$;

create function app_snow_window.add_person(p_name text, p_emoji text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_row app_snow_window.people;
begin
  -- Serialise adds so two at once cannot both take the 20th place.
  lock table app_snow_window.people in share row exclusive mode;
  if (select count(*) from app_snow_window.people) >= 20 then
    raise exception 'board_full' using errcode = 'P0001';
  end if;
  insert into app_snow_window.people (name, emoji)
  values (regexp_replace(btrim(p_name), '\s+', ' ', 'g'), btrim(p_emoji))
  returning * into v_row;
  return jsonb_build_object('id', v_row.id, 'token', v_row.token);
end;
$$;

create function app_snow_window.set_days(p_id uuid, p_token uuid, p_days date[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from unnest(p_days) d where d < date '2026-12-01' or d > date '2027-04-30') then
    raise exception 'day_outside_season' using errcode = 'P0001';
  end if;
  update app_snow_window.people
     set days = coalesce((select array_agg(distinct d order by d) from unnest(p_days) d), '{}')
   where id = p_id and token = p_token;
  if not found then
    raise exception 'not_your_row' using errcode = 'P0001';
  end if;
end;
$$;

create function app_snow_window.remove_person(p_id uuid, p_token uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from app_snow_window.people where id = p_id and token = p_token;
  if not found then
    raise exception 'not_your_row' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on all functions in schema app_snow_window from public;
grant execute on function
  app_snow_window.get_board(),
  app_snow_window.add_person(text, text),
  app_snow_window.set_days(uuid, uuid, date[]),
  app_snow_window.remove_person(uuid, uuid)
to anon, authenticated;

select platform.gate_tables('snow_window');
