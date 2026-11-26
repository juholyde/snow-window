-- app_snow_window: places to stay come after the crew agrees on a trip.
-- A suggestion is now dates + resort + plan. Once its proposer marks it on,
-- any member sets a budget and whether the crew drives (both feed the AI
-- prompt in src/lib/trips.ts), adds stay options (by hand or pasted from an
-- AI answer), votes on them and marks one booked. Limits mirror trips.ts.

create table app_snow_window.stays (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app_snow_window.trips (id) on delete cascade,
  added_by uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  url text check (url ~ '^https://\S+$' and char_length(url) <= 500),
  price numeric(7, 2) check (price >= 0 and price < 10000),
  why text check (char_length(why) <= 300),
  created_at timestamptz not null default now()
);
create index stays_trip_idx on app_snow_window.stays (trip_id);

create table app_snow_window.stay_votes (
  stay_id uuid not null references app_snow_window.stays (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (stay_id, user_id)
);

-- The old single stay on a trip becomes its first option.
insert into app_snow_window.stays (trip_id, added_by, name, url, price, why)
select id, proposer_id, coalesce(left(stay_note, 80), 'Place to stay'), stay_url, stay_price, stay_note
  from app_snow_window.trips
 where stay_url is not null or stay_price is not null or stay_note is not null;

alter table app_snow_window.trips
  drop column stay_url,
  drop column stay_price,
  drop column stay_note,
  add column stay_budget smallint check (stay_budget >= 0 and stay_budget < 10000),
  add column driving boolean,
  add column booked_stay uuid references app_snow_window.stays (id) on delete set null;

alter table app_snow_window.stays enable row level security;
alter table app_snow_window.stay_votes enable row level security;
create policy stays_read on app_snow_window.stays for select to authenticated
  using (exists (select 1 from app_snow_window.trips t
                  where t.id = trip_id and app_snow_window.is_member(t.crew_id)));
create policy stay_votes_read on app_snow_window.stay_votes for select to authenticated
  using (exists (select 1 from app_snow_window.stays s join app_snow_window.trips t on t.id = s.trip_id
                  where s.id = stay_id and app_snow_window.is_member(t.crew_id)));
grant select on app_snow_window.stays, app_snow_window.stay_votes to authenticated;

-- A trip whose stay you may change: you're in its crew, it's on, it has a night.
create function app_snow_window.require_stay_trip(p_trip uuid)
returns app_snow_window.trips
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_trip app_snow_window.trips;
begin
  select * into v_trip from app_snow_window.trips where id = p_trip;
  if v_trip.id is null or not app_snow_window.is_member(v_trip.crew_id) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if v_trip.end_date = v_trip.start_date then
    raise exception 'day_trip_no_stay' using errcode = 'P0001';
  end if;
  if v_trip.status <> 'on' then
    raise exception 'trip_not_on' using errcode = 'P0001';
  end if;
  return v_trip;
end;
$$;

-- Votes leave with the member; the places they added stay for the crew.
create or replace function app_snow_window.drop_member(p_crew uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from app_snow_window.crew_members where crew_id = p_crew and user_id = p_user;
  delete from app_snow_window.trips where crew_id = p_crew and proposer_id = p_user;
  delete from app_snow_window.responses r using app_snow_window.trips t
   where r.trip_id = t.id and t.crew_id = p_crew and r.user_id = p_user;
  delete from app_snow_window.stay_votes v using app_snow_window.stays s, app_snow_window.trips t
   where v.stay_id = s.id and s.trip_id = t.id and t.crew_id = p_crew and v.user_id = p_user;
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

create or replace function app_snow_window.get_crew(p_crew uuid)
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
        'status', t.status, 'createdAt', t.created_at,
        'stayBudget', t.stay_budget, 'driving', t.driving, 'bookedStay', t.booked_stay,
        'responses', coalesce((select jsonb_object_agg(r.user_id, r.answer)
                                 from app_snow_window.responses r where r.trip_id = t.id), '{}'::jsonb),
        'stays', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id, 'addedBy', s.added_by, 'name', s.name, 'url', s.url, 'price', s.price, 'why', s.why,
            'votes', coalesce((select jsonb_agg(v.user_id) from app_snow_window.stay_votes v
                                where v.stay_id = s.id), '[]'::jsonb)
          ) order by s.created_at, s.id)
            from app_snow_window.stays s where s.trip_id = t.id), '[]'::jsonb)
      ) order by t.created_at desc)
        from app_snow_window.trips t where t.crew_id = p_crew), '[]'::jsonb));
end;
$$;

drop function app_snow_window.create_trip(uuid, text, date, date, text, text, text, numeric, text);
create function app_snow_window.create_trip(
  p_crew uuid, p_resort text, p_start date, p_end date, p_title text, p_note text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app_snow_window.me();
  v_id uuid;
begin
  perform app_snow_window.require_member(p_crew);
  perform 1 from app_snow_window.crews where id = p_crew for update;
  if (select count(*) from app_snow_window.trips where crew_id = p_crew) >= 40 then
    raise exception 'trips_full' using errcode = 'P0001';
  end if;
  insert into app_snow_window.trips (crew_id, proposer_id, resort_id, start_date, end_date, title, note)
  values (p_crew, v_me, p_resort, p_start, p_end, nullif(btrim(p_title), ''), nullif(btrim(p_note), ''))
  returning id into v_id;
  insert into app_snow_window.responses (trip_id, user_id, answer) values (v_id, v_me, 'yes');
  return v_id;
end;
$$;

create function app_snow_window.set_stay_prefs(p_trip uuid, p_budget integer, p_driving boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_snow_window.require_stay_trip(p_trip);
  update app_snow_window.trips set stay_budget = p_budget, driving = p_driving where id = p_trip;
end;
$$;

-- p_stays: [{ name, url, price, why }], up to 8 options per trip in all.
create function app_snow_window.add_stays(p_trip uuid, p_stays jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_snow_window.require_stay_trip(p_trip);
  perform 1 from app_snow_window.trips where id = p_trip for update;
  if (select count(*) from app_snow_window.stays where trip_id = p_trip)
     + jsonb_array_length(p_stays) > 8 then
    raise exception 'stays_full' using errcode = 'P0001';
  end if;
  -- created_at keeps the pasted order (one statement shares one now()).
  insert into app_snow_window.stays (trip_id, added_by, name, url, price, why, created_at)
  select p_trip, app_snow_window.me(), btrim(e->>'name'), nullif(btrim(e->>'url'), ''),
         (e->>'price')::numeric, nullif(btrim(e->>'why'), ''), now() + make_interval(secs => i / 1e6)
    from jsonb_array_elements(p_stays) with ordinality as x (e, i);
end;
$$;

-- The person who added a place, or the trip's proposer, can take it off.
create function app_snow_window.remove_stay(p_stay uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_stay app_snow_window.stays;
  v_trip app_snow_window.trips;
begin
  select * into v_stay from app_snow_window.stays where id = p_stay;
  v_trip := app_snow_window.require_stay_trip(v_stay.trip_id);
  if app_snow_window.me() not in (v_stay.added_by, v_trip.proposer_id) then
    raise exception 'not_your_stay' using errcode = 'P0001';
  end if;
  delete from app_snow_window.stays where id = p_stay;
end;
$$;

create function app_snow_window.vote_stay(p_stay uuid, p_vote boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_snow_window.require_stay_trip((select trip_id from app_snow_window.stays where id = p_stay));
  if p_vote then
    insert into app_snow_window.stay_votes (stay_id, user_id) values (p_stay, app_snow_window.me())
    on conflict do nothing;
  else
    delete from app_snow_window.stay_votes where stay_id = p_stay and user_id = app_snow_window.me();
  end if;
end;
$$;

-- Marks the place the crew booked; null clears it.
create function app_snow_window.book_stay(p_trip uuid, p_stay uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_snow_window.require_stay_trip(p_trip);
  if p_stay is not null and not exists (
    select 1 from app_snow_window.stays where id = p_stay and trip_id = p_trip) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  update app_snow_window.trips set booked_stay = p_stay where id = p_trip;
end;
$$;

grant execute on function
  app_snow_window.create_trip(uuid, text, date, date, text, text),
  app_snow_window.set_stay_prefs(uuid, integer, boolean),
  app_snow_window.add_stays(uuid, jsonb),
  app_snow_window.remove_stay(uuid),
  app_snow_window.vote_stay(uuid, boolean),
  app_snow_window.book_stay(uuid, uuid)
to authenticated;

select platform.gate_tables('snow_window');
