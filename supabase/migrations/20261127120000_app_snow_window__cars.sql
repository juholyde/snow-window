-- app_snow_window: car seats on trips that are on.
-- A member offers a car with N free passenger seats; other members take a seat
-- or leave it. Day trips get cars too. Limits mirror src/lib/trips.ts.

create table app_snow_window.cars (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app_snow_window.trips (id) on delete cascade,
  driver_id uuid not null references auth.users (id) on delete cascade,
  seats integer not null check (seats between 1 and 8),
  note text check (char_length(note) <= 80),
  created_at timestamptz not null default now(),
  unique (trip_id, driver_id)
);

create table app_snow_window.car_seats (
  car_id uuid not null references app_snow_window.cars (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (car_id, user_id)
);

alter table app_snow_window.cars enable row level security;
alter table app_snow_window.car_seats enable row level security;
create policy cars_read on app_snow_window.cars for select to authenticated
  using (exists (select 1 from app_snow_window.trips t
                  where t.id = trip_id and app_snow_window.is_member(t.crew_id)));
create policy car_seats_read on app_snow_window.car_seats for select to authenticated
  using (exists (select 1 from app_snow_window.cars c join app_snow_window.trips t on t.id = c.trip_id
                  where c.id = car_id and app_snow_window.is_member(t.crew_id)));
grant select on app_snow_window.cars, app_snow_window.car_seats to authenticated;

-- A trip whose cars you may change: you're in its crew and it's on (day trips too).
create function app_snow_window.require_car_trip(p_trip uuid)
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
  if v_trip.status <> 'on' then
    raise exception 'trip_not_on' using errcode = 'P0001';
  end if;
  return v_trip;
end;
$$;

-- A leaver's cars and seats go with them (cars take their riders along).
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
  delete from app_snow_window.car_seats x using app_snow_window.cars c, app_snow_window.trips t
   where x.car_id = c.id and c.trip_id = t.id and t.crew_id = p_crew and x.user_id = p_user;
  delete from app_snow_window.cars c using app_snow_window.trips t
   where c.trip_id = t.id and t.crew_id = p_crew and c.driver_id = p_user;
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
            from app_snow_window.stays s where s.trip_id = t.id), '[]'::jsonb),
        'cars', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c.id, 'driverId', c.driver_id, 'seats', c.seats, 'note', c.note,
            'riders', coalesce((select jsonb_agg(s.user_id order by s.claimed_at, s.user_id)
                                  from app_snow_window.car_seats s where s.car_id = c.id), '[]'::jsonb)
          ) order by c.created_at, c.id)
            from app_snow_window.cars c where c.trip_id = t.id), '[]'::jsonb)
      ) order by t.created_at desc)
        from app_snow_window.trips t where t.crew_id = p_crew), '[]'::jsonb));
end;
$$;


-- Offers (or updates) my car on a trip. A driver holds no seat in another car.
create function app_snow_window.offer_car(p_trip uuid, p_seats integer, p_note text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app_snow_window.me();
  v_id uuid;
begin
  perform app_snow_window.require_car_trip(p_trip);
  perform 1 from app_snow_window.trips where id = p_trip for update;
  if p_seats is null or p_seats not between 1 and 8 then
    raise exception 'bad_seats' using errcode = 'P0001';
  end if;
  if exists (select 1 from app_snow_window.cars where trip_id = p_trip and driver_id = v_me) then
    raise exception 'car_exists' using errcode = 'P0001';
  end if;
  delete from app_snow_window.car_seats x using app_snow_window.cars c
   where x.car_id = c.id and c.trip_id = p_trip and x.user_id = v_me;
  insert into app_snow_window.cars (trip_id, driver_id, seats, note)
  values (p_trip, v_me, p_seats, nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- The driver, or the trip's proposer, takes a car off.
create function app_snow_window.remove_car(p_car uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_car app_snow_window.cars;
  v_trip app_snow_window.trips;
begin
  select * into v_car from app_snow_window.cars where id = p_car;
  v_trip := app_snow_window.require_car_trip(v_car.trip_id);
  if app_snow_window.me() not in (v_car.driver_id, v_trip.proposer_id) then
    raise exception 'not_your_car' using errcode = 'P0001';
  end if;
  delete from app_snow_window.cars where id = p_car;
end;
$$;

-- Takes a seat in a car; a person holds one seat per trip, so this moves them.
create function app_snow_window.claim_seat(p_car uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app_snow_window.me();
  v_car app_snow_window.cars;
begin
  select * into v_car from app_snow_window.cars where id = p_car;
  perform app_snow_window.require_car_trip(v_car.trip_id);
  perform 1 from app_snow_window.cars where id = p_car for update;
  if exists (select 1 from app_snow_window.cars where trip_id = v_car.trip_id and driver_id = v_me) then
    raise exception 'own_car' using errcode = 'P0001';
  end if;
  if exists (select 1 from app_snow_window.car_seats where car_id = p_car and user_id = v_me) then
    return;
  end if;
  if (select count(*) from app_snow_window.car_seats where car_id = p_car) >= v_car.seats then
    raise exception 'car_full' using errcode = 'P0001';
  end if;
  delete from app_snow_window.car_seats x using app_snow_window.cars c
   where x.car_id = c.id and c.trip_id = v_car.trip_id and x.user_id = v_me;
  insert into app_snow_window.car_seats (car_id, user_id) values (p_car, v_me);
end;
$$;

create function app_snow_window.leave_seat(p_car uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app_snow_window.require_car_trip((select trip_id from app_snow_window.cars where id = p_car));
  delete from app_snow_window.car_seats where car_id = p_car and user_id = app_snow_window.me();
end;
$$;

grant execute on function
  app_snow_window.offer_car(uuid, integer, text),
  app_snow_window.remove_car(uuid),
  app_snow_window.claim_seat(uuid),
  app_snow_window.leave_seat(uuid)
to authenticated;

select platform.gate_tables('snow_window');
