-- Trip suggestions and answers. Same model as people: no table policies,
-- anonymous visitors only go through the functions below, and every write
-- names one of the caller's rows and carries that row's token.
-- Limits mirrored in src/lib/trips.ts: 40 suggestions, 14 days, season dates,
-- known resorts, https stay links.

create table app_snow_window.suggestions (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid not null references app_snow_window.people (id) on delete cascade,
  resort_id text not null check (resort_id in
    ('baqueira', 'la-molina', 'grandvalira', 'pal-arinsal', 'formigal', 'cerler', 'sierra-nevada')),
  start_date date not null check (start_date >= date '2026-12-01'),
  end_date date not null check (end_date <= date '2027-04-30'),
  title text check (char_length(title) <= 60),
  note text check (char_length(note) <= 500),
  stay_url text check (stay_url ~ '^https://' and char_length(stay_url) <= 500),
  stay_price numeric(7, 2) check (stay_price >= 0 and stay_price < 10000),
  stay_note text check (char_length(stay_note) <= 300),
  status text not null default 'open' check (status in ('open', 'on', 'cancelled')),
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 13),
  -- A day trip has no stay.
  check (end_date > start_date or (stay_url is null and stay_price is null and stay_note is null))
);
alter table app_snow_window.suggestions enable row level security;

create table app_snow_window.responses (
  suggestion_id uuid not null references app_snow_window.suggestions (id) on delete cascade,
  person_id uuid not null references app_snow_window.people (id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (suggestion_id, person_id)
);
alter table app_snow_window.responses enable row level security;

create function app_snow_window.owns_row(p_person uuid, p_token uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from app_snow_window.people where id = p_person and token = p_token);
$$;

create function app_snow_window.get_trips()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'proposerId', s.proposer_id, 'resortId', s.resort_id,
    'start', s.start_date, 'end', s.end_date, 'title', s.title, 'note', s.note,
    'stayUrl', s.stay_url, 'stayPrice', s.stay_price, 'stayNote', s.stay_note,
    'status', s.status, 'createdAt', s.created_at,
    'responses', coalesce((select jsonb_object_agg(r.person_id, r.answer)
                           from app_snow_window.responses r where r.suggestion_id = s.id), '{}'::jsonb)
  ) order by s.created_at desc), '[]'::jsonb)
  from app_snow_window.suggestions s;
$$;

create function app_snow_window.create_trip(
  p_person uuid, p_token uuid, p_resort text, p_start date, p_end date,
  p_title text, p_note text, p_stay_url text, p_stay_price numeric, p_stay_note text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_day_trip boolean := p_end = p_start;
begin
  if not app_snow_window.owns_row(p_person, p_token) then
    raise exception 'not_your_row' using errcode = 'P0001';
  end if;
  lock table app_snow_window.suggestions in share row exclusive mode;
  if (select count(*) from app_snow_window.suggestions) >= 40 then
    raise exception 'trips_full' using errcode = 'P0001';
  end if;
  insert into app_snow_window.suggestions
    (proposer_id, resort_id, start_date, end_date, title, note, stay_url, stay_price, stay_note)
  values (p_person, p_resort, p_start, p_end, nullif(btrim(p_title), ''), nullif(btrim(p_note), ''),
          case when v_day_trip then null else nullif(btrim(p_stay_url), '') end,
          case when v_day_trip then null else p_stay_price end,
          case when v_day_trip then null else nullif(btrim(p_stay_note), '') end)
  returning id into v_id;
  insert into app_snow_window.responses (suggestion_id, person_id, answer) values (v_id, p_person, 'yes');
  return v_id;
end;
$$;

create function app_snow_window.respond(p_trip uuid, p_person uuid, p_token uuid, p_answer text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app_snow_window.owns_row(p_person, p_token) then
    raise exception 'not_your_row' using errcode = 'P0001';
  end if;
  if not exists (select 1 from app_snow_window.suggestions where id = p_trip and status <> 'cancelled') then
    raise exception 'trip_closed' using errcode = 'P0001';
  end if;
  insert into app_snow_window.responses (suggestion_id, person_id, answer)
  values (p_trip, p_person, p_answer)
  on conflict (suggestion_id, person_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;

create function app_snow_window.set_trip_status(p_trip uuid, p_person uuid, p_token uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app_snow_window.owns_row(p_person, p_token) then
    raise exception 'not_your_row' using errcode = 'P0001';
  end if;
  update app_snow_window.suggestions set status = p_status
   where id = p_trip and proposer_id = p_person;
  if not found then
    raise exception 'not_your_trip' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function app_snow_window.owns_row(uuid, uuid) from public;
grant execute on function
  app_snow_window.get_trips(),
  app_snow_window.create_trip(uuid, uuid, text, date, date, text, text, text, numeric, text),
  app_snow_window.respond(uuid, uuid, uuid, text),
  app_snow_window.set_trip_status(uuid, uuid, uuid, text)
to anon, authenticated;

select platform.gate_tables('snow_window');
