-- app_snow_window: Snow Window, ski-trip planning for crews of friends.
-- Spec: docs/spec/auth-and-crews.md. Everyone is signed in, at first as an
-- anonymous (guest) account, so the app allows anonymous members.
-- Reads: member-only RLS policies, plus the sandbox app_gate. Writes: the
-- security-definer functions below, which use auth.uid() and enforce the
-- guardrails mirrored in src/lib/rules.ts and src/lib/trips.ts.

create schema app_snow_window;
grant usage on schema app_snow_window to authenticated, service_role;
alter default privileges in schema app_snow_window grant all on tables to service_role;
-- Functions are not executable by anyone unless granted below.
alter default privileges in schema app_snow_window revoke execute on functions from public;

insert into platform.apps (slug, name, join_mode, allow_anonymous, redirect_urls)
values ('snow_window', 'Snow Window', 'open', true,
        array['https://juholyde.github.io/snow-window/', 'http://localhost:5191/']::text[]);

-- One per person: name, avatar and the one calendar every crew of theirs sees.
create table app_snow_window.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  emoji text not null check (char_length(emoji) between 1 and 16),
  days date[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table app_snow_window.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  -- Null only after the owner's account is deleted.
  owner_id uuid references auth.users (id) on delete set null,
  invite_code uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table app_snow_window.crew_members (
  crew_id uuid not null references app_snow_window.crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index crew_members_user_idx on app_snow_window.crew_members (user_id);

create table app_snow_window.trips (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references app_snow_window.crews (id) on delete cascade,
  proposer_id uuid not null references auth.users (id) on delete cascade,
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
create index trips_crew_idx on app_snow_window.trips (crew_id);

create table app_snow_window.responses (
  trip_id uuid not null references app_snow_window.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table app_snow_window.profiles enable row level security;
alter table app_snow_window.crews enable row level security;
alter table app_snow_window.crew_members enable row level security;
alter table app_snow_window.trips enable row level security;
alter table app_snow_window.responses enable row level security;

-- Helpers ---------------------------------------------------------------

create function app_snow_window.me()
returns uuid
language plpgsql stable set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  return auth.uid();
end;
$$;

create function app_snow_window.is_member(p_crew uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from app_snow_window.crew_members
                  where crew_id = p_crew and user_id = auth.uid());
$$;

create function app_snow_window.shares_crew(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user = auth.uid() or exists (
    select 1 from app_snow_window.crew_members a
      join app_snow_window.crew_members b using (crew_id)
     where a.user_id = auth.uid() and b.user_id = p_user);
$$;

create function app_snow_window.require_member(p_crew uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not app_snow_window.is_member(p_crew) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
end;
$$;

create function app_snow_window.require_owner(p_crew uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from app_snow_window.crews where id = p_crew and owner_id = auth.uid()) then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;
end;
$$;

create function app_snow_window.require_profile()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from app_snow_window.profiles where user_id = app_snow_window.me()) then
    raise exception 'no_profile' using errcode = 'P0001';
  end if;
end;
$$;

-- Read policies: you see your crews, their members, the profiles of people
-- who share a crew with you, and your crews' trips and answers.
create policy crews_read on app_snow_window.crews for select to authenticated
  using (app_snow_window.is_member(id));
create policy members_read on app_snow_window.crew_members for select to authenticated
  using (app_snow_window.is_member(crew_id));
create policy profiles_read on app_snow_window.profiles for select to authenticated
  using (app_snow_window.shares_crew(user_id));
create policy trips_read on app_snow_window.trips for select to authenticated
  using (app_snow_window.is_member(crew_id));
create policy responses_read on app_snow_window.responses for select to authenticated
  using (exists (select 1 from app_snow_window.trips t
                  where t.id = trip_id and app_snow_window.is_member(t.crew_id)));
grant select on all tables in schema app_snow_window to authenticated;

-- Profile -----------------------------------------------------------------

create function app_snow_window.get_profile()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', p.user_id, 'name', p.name, 'emoji', p.emoji, 'days', to_jsonb(p.days))
    from app_snow_window.profiles p where p.user_id = app_snow_window.me();
$$;

create function app_snow_window.save_profile(p_name text, p_emoji text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into app_snow_window.profiles (user_id, name, emoji)
  values (app_snow_window.me(), regexp_replace(btrim(p_name), '\s+', ' ', 'g'), btrim(p_emoji))
  on conflict (user_id) do update
    set name = excluded.name, emoji = excluded.emoji, updated_at = now();
end;
$$;

create function app_snow_window.set_days(p_days date[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from unnest(p_days) d where d < date '2026-12-01' or d > date '2027-04-30') then
    raise exception 'day_outside_season' using errcode = 'P0001';
  end if;
  update app_snow_window.profiles
     set days = coalesce((select array_agg(distinct d order by d) from unnest(p_days) d), '{}'),
         updated_at = now()
   where user_id = app_snow_window.me();
  if not found then
    raise exception 'no_profile' using errcode = 'P0001';
  end if;
end;
$$;

-- Crews -------------------------------------------------------------------

create function app_snow_window.my_crews()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'ownerId', c.owner_id, 'inviteCode', c.invite_code,
    'members', (select count(*) from app_snow_window.crew_members x where x.crew_id = c.id)
  ) order by m.joined_at), '[]'::jsonb)
  from app_snow_window.crew_members m
  join app_snow_window.crews c on c.id = m.crew_id
  where m.user_id = app_snow_window.me();
$$;

create function app_snow_window.create_crew(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app_snow_window.me();
  v_id uuid;
begin
  perform app_snow_window.require_profile();
  if (select count(*) from app_snow_window.crews where owner_id = v_me) >= 10
     or (select count(*) from app_snow_window.crew_members where user_id = v_me) >= 20 then
    raise exception 'too_many_crews' using errcode = 'P0001';
  end if;
  insert into app_snow_window.crews (name, owner_id)
  values (regexp_replace(btrim(p_name), '\s+', ' ', 'g'), v_me)
  returning id into v_id;
  insert into app_snow_window.crew_members (crew_id, user_id) values (v_id, v_me);
  return v_id;
end;
$$;

-- What an invite link shows before you join. Null for an unknown code.
create function app_snow_window.crew_preview(p_code uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name,
    'members', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'emoji', p.emoji) order by m.joined_at)
                           from app_snow_window.crew_members m
                           join app_snow_window.profiles p on p.user_id = m.user_id
                          where m.crew_id = c.id), '[]'::jsonb))
  from app_snow_window.crews c where c.invite_code = p_code;
$$;

create function app_snow_window.join_crew(p_code uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app_snow_window.me();
  v_crew uuid;
begin
  perform app_snow_window.require_profile();
  -- Lock the crew so two joins at once cannot both take the 20th place.
  select id into v_crew from app_snow_window.crews where invite_code = p_code for update;
  if v_crew is null then
    raise exception 'bad_invite' using errcode = 'P0001';
  end if;
  if app_snow_window.is_member(v_crew) then
    return v_crew;
  end if;
  if (select count(*) from app_snow_window.crew_members where crew_id = v_crew) >= 20 then
    raise exception 'crew_full' using errcode = 'P0001';
  end if;
  if (select count(*) from app_snow_window.crew_members where user_id = v_me) >= 20 then
    raise exception 'too_many_crews' using errcode = 'P0001';
  end if;
  insert into app_snow_window.crew_members (crew_id, user_id) values (v_crew, v_me);
  return v_crew;
end;
$$;

create function app_snow_window.rename_crew(p_crew uuid, p_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_snow_window.require_owner(p_crew);
  update app_snow_window.crews set name = regexp_replace(btrim(p_name), '\s+', ' ', 'g') where id = p_crew;
end;
$$;

create function app_snow_window.reset_invite(p_crew uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_code uuid := gen_random_uuid();
begin
  perform app_snow_window.require_owner(p_crew);
  update app_snow_window.crews set invite_code = v_code where id = p_crew;
  return v_code;
end;
$$;

-- Takes someone out of a crew with their suggestions and answers there.
-- Passes the crew on if its owner goes; deletes it when nobody is left.
create function app_snow_window.drop_member(p_crew uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from app_snow_window.crew_members where crew_id = p_crew and user_id = p_user;
  delete from app_snow_window.trips where crew_id = p_crew and proposer_id = p_user;
  delete from app_snow_window.responses r using app_snow_window.trips t
   where r.trip_id = t.id and t.crew_id = p_crew and r.user_id = p_user;
  if not exists (select 1 from app_snow_window.crew_members where crew_id = p_crew) then
    delete from app_snow_window.crews where id = p_crew;
  else
    update app_snow_window.crews c
       set owner_id = (select m.user_id from app_snow_window.crew_members m
                        where m.crew_id = p_crew order by m.joined_at, m.user_id limit 1)
     where c.id = p_crew and (c.owner_id is null or c.owner_id = p_user);
  end if;
end;
$$;

create function app_snow_window.remove_member(p_crew uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_snow_window.require_owner(p_crew);
  if p_user = app_snow_window.me() then
    raise exception 'use_leave' using errcode = 'P0001';
  end if;
  perform app_snow_window.drop_member(p_crew, p_user);
end;
$$;

create function app_snow_window.leave_crew(p_crew uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_snow_window.require_member(p_crew);
  perform app_snow_window.drop_member(p_crew, app_snow_window.me());
end;
$$;

-- The crew's board: its members' calendars and its trips.
create function app_snow_window.get_crew(p_crew uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform app_snow_window.require_member(p_crew);
  return jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.user_id, 'name', p.name, 'emoji', p.emoji,
                                          'days', to_jsonb(p.days)) order by m.joined_at)
        from app_snow_window.crew_members m
        join app_snow_window.profiles p on p.user_id = m.user_id
       where m.crew_id = p_crew), '[]'::jsonb),
    'trips', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'proposerId', t.proposer_id, 'resortId', t.resort_id,
        'start', t.start_date, 'end', t.end_date, 'title', t.title, 'note', t.note,
        'stayUrl', t.stay_url, 'stayPrice', t.stay_price, 'stayNote', t.stay_note,
        'status', t.status, 'createdAt', t.created_at,
        'responses', coalesce((select jsonb_object_agg(r.user_id, r.answer)
                                 from app_snow_window.responses r where r.trip_id = t.id), '{}'::jsonb)
      ) order by t.created_at desc)
        from app_snow_window.trips t where t.crew_id = p_crew), '[]'::jsonb));
end;
$$;

-- Trips -------------------------------------------------------------------

create function app_snow_window.create_trip(
  p_crew uuid, p_resort text, p_start date, p_end date,
  p_title text, p_note text, p_stay_url text, p_stay_price numeric, p_stay_note text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app_snow_window.me();
  v_id uuid;
  v_day_trip boolean := p_end = p_start;
begin
  perform app_snow_window.require_member(p_crew);
  perform 1 from app_snow_window.crews where id = p_crew for update;
  if (select count(*) from app_snow_window.trips where crew_id = p_crew) >= 40 then
    raise exception 'trips_full' using errcode = 'P0001';
  end if;
  insert into app_snow_window.trips
    (crew_id, proposer_id, resort_id, start_date, end_date, title, note, stay_url, stay_price, stay_note)
  values (p_crew, v_me, p_resort, p_start, p_end, nullif(btrim(p_title), ''), nullif(btrim(p_note), ''),
          case when v_day_trip then null else nullif(btrim(p_stay_url), '') end,
          case when v_day_trip then null else p_stay_price end,
          case when v_day_trip then null else nullif(btrim(p_stay_note), '') end)
  returning id into v_id;
  insert into app_snow_window.responses (trip_id, user_id, answer) values (v_id, v_me, 'yes');
  return v_id;
end;
$$;

create function app_snow_window.respond(p_trip uuid, p_answer text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_trip app_snow_window.trips;
begin
  select * into v_trip from app_snow_window.trips where id = p_trip;
  if v_trip.id is null or not app_snow_window.is_member(v_trip.crew_id) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if v_trip.status = 'cancelled' then
    raise exception 'trip_closed' using errcode = 'P0001';
  end if;
  insert into app_snow_window.responses (trip_id, user_id, answer)
  values (p_trip, app_snow_window.me(), p_answer)
  on conflict (trip_id, user_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;

create function app_snow_window.set_trip_status(p_trip uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update app_snow_window.trips set status = p_status
   where id = p_trip and proposer_id = app_snow_window.me();
  if not found then
    raise exception 'not_your_trip' using errcode = 'P0001';
  end if;
end;
$$;

grant execute on function
  app_snow_window.is_member(uuid),
  app_snow_window.shares_crew(uuid),
  app_snow_window.get_profile(),
  app_snow_window.save_profile(text, text),
  app_snow_window.set_days(date[]),
  app_snow_window.my_crews(),
  app_snow_window.create_crew(text),
  app_snow_window.crew_preview(uuid),
  app_snow_window.join_crew(uuid),
  app_snow_window.rename_crew(uuid, text),
  app_snow_window.reset_invite(uuid),
  app_snow_window.remove_member(uuid, uuid),
  app_snow_window.leave_crew(uuid),
  app_snow_window.get_crew(uuid),
  app_snow_window.create_trip(uuid, text, date, date, text, text, text, numeric, text),
  app_snow_window.respond(uuid, text),
  app_snow_window.set_trip_status(uuid, text)
to authenticated;

select platform.gate_tables('snow_window');
