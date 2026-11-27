-- app_snow_window: where people live and where a crew looks.
-- Every resort in src/config/resorts.ts becomes a valid trip destination, a
-- person may store a home city (src/config/cities.ts; the app checks the list,
-- the database only the shape), and a crew stores which areas it considers.

alter table app_snow_window.trips drop constraint trips_resort_id_check;
alter table app_snow_window.trips add constraint trips_resort_id_check check (resort_id in
    ('baqueira', 'la-molina', 'grandvalira', 'pal-arinsal', 'formigal', 'cerler', 'sierra-nevada',
     'chamonix', 'val-thorens', 'tignes', 'zermatt', 'verbier', 'st-anton', 'kitzbuehel', 'cervinia',
     'levi', 'yllas', 'ruka', 'pyha', 'saariselka', 'are', 'salen', 'vemdalen', 'riksgransen', 'idre-fjall'));

alter table app_snow_window.profiles
  add column home_city text check (home_city ~ '^[a-z0-9-]{1,40}$');

alter table app_snow_window.crews
  add column regions text[] not null default '{spain}'
    check (cardinality(regions) >= 1 and regions <@ array['spain', 'alps', 'finland', 'sweden']::text[]);

-- Profile and crew list now carry the new fields.
create or replace function app_snow_window.get_profile()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', p.user_id, 'name', p.name, 'emoji', p.emoji, 'days', to_jsonb(p.days),
                            'homeCity', p.home_city)
    from app_snow_window.profiles p where p.user_id = app_snow_window.me();
$$;

create or replace function app_snow_window.my_crews()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'ownerId', c.owner_id, 'inviteCode', c.invite_code,
    'members', (select count(*) from app_snow_window.crew_members x where x.crew_id = c.id),
    'regions', to_jsonb(c.regions)
  ) order by m.joined_at), '[]'::jsonb)
  from app_snow_window.crew_members m
  join app_snow_window.crews c on c.id = m.crew_id
  where m.user_id = app_snow_window.me();
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
                                          'days', to_jsonb(p.days), 'homeCity', p.home_city) order by m.joined_at)
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

-- Null clears it.
create function app_snow_window.set_home_city(p_city text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_city is not null and p_city !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'bad_city' using errcode = 'P0001';
  end if;
  update app_snow_window.profiles set home_city = p_city, updated_at = now()
   where user_id = app_snow_window.me();
  if not found then
    raise exception 'no_profile' using errcode = 'P0001';
  end if;
end;
$$;

-- Any member. Deduped, in the order spain, alps, finland, sweden.
create function app_snow_window.set_crew_regions(p_crew uuid, p_regions text[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_regions text[];
begin
  perform app_snow_window.require_member(p_crew);
  select array_agg(r order by array_position(array['spain', 'alps', 'finland', 'sweden']::text[], r))
    into v_regions
    from (select distinct r from unnest(p_regions) r) x;
  if v_regions is null or not v_regions <@ array['spain', 'alps', 'finland', 'sweden']::text[] then
    raise exception 'bad_regions' using errcode = 'P0001';
  end if;
  update app_snow_window.crews set regions = v_regions where id = p_crew;
end;
$$;

grant execute on function
  app_snow_window.set_home_city(text),
  app_snow_window.set_crew_regions(uuid, text[])
to authenticated;

select platform.gate_tables('snow_window');
