import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

const migrations = ['20261125160000_app_snow_window__init.sql', '20261126120000_app_snow_window__stays.sql', '20261127120000_app_snow_window__cars.sql', '20261128120000_app_snow_window__regions.sql'].map((f) =>
  readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8'),
)

// Just enough of Supabase auth and the sandbox platform for the migration to run.
const stub = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  create schema platform;
  create table platform.apps (slug text primary key, name text, join_mode text, allow_anonymous boolean, redirect_urls text[]);
  create function platform.gate_tables(slug text) returns void language sql as 'select';
`

let db: PGlite

async function newUser(name?: string): Promise<string> {
  const id = crypto.randomUUID()
  await db.query('insert into auth.users (id) values ($1)', [id])
  if (name) await as(id, 'select app_snow_window.save_profile($1, $2)', [name, '⛷️'])
  return id
}

/** Runs one statement as a signed-in user (the authenticated role with that user's id). */
async function as<T = unknown>(user: string, sql: string, params: unknown[] = []): Promise<T> {
  const row = (await rows(user, sql, params))[0]
  return (row ? Object.values(row)[0] : undefined) as T
}

async function rows(user: string, sql: string, params: unknown[] = []) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user])
  await db.exec('set role authenticated')
  try {
    return (await db.query<Record<string, unknown>>(sql, params)).rows
  } finally {
    await db.exec('reset role')
  }
}

async function crewWith(owner: string, ...others: string[]) {
  const crew = await as<string>(owner, "select app_snow_window.create_crew('Pyrenees gang')")
  const code = await as<string>(owner, 'select invite_code from app_snow_window.crews where id = $1', [crew])
  for (const o of others) await as(o, 'select app_snow_window.join_crew($1)', [code])
  return { crew, code }
}

beforeEach(async () => {
  db = new PGlite()
  await db.exec(stub)
  for (const m of migrations) await db.exec(m)
})

describe('crews', () => {
  it('shows people only the crews, profiles and trips they share', async () => {
    const juho = await newUser('Juho')
    const laura = await newUser('Laura')
    const stranger = await newUser('Stranger')
    const { crew } = await crewWith(juho, laura)
    await as(laura, 'select app_snow_window.create_trip($1, $2, $3, $4, null, null)', [
      crew, 'baqueira', '2027-01-09', '2027-01-09',
    ])

    const names = async (u: string) => (await rows(u, 'select name from app_snow_window.profiles order by name')).map((r) => r.name)
    expect(await names(laura)).toEqual(['Juho', 'Laura'])
    expect(await names(stranger)).toEqual(['Stranger'])
    expect(await rows(stranger, 'select * from app_snow_window.crews')).toEqual([])
    expect(await rows(stranger, 'select * from app_snow_window.trips')).toEqual([])
    await expect(as(stranger, 'select app_snow_window.get_crew($1)', [crew])).rejects.toThrow(/not_member/)
  })

  it('joins by invite link up to 20 people, and a reset link stops the old one', async () => {
    const owner = await newUser('Owner')
    const { crew, code } = await crewWith(owner)
    expect(await as(owner, 'select app_snow_window.crew_preview($1)', [code])).toMatchObject({
      name: 'Pyrenees gang',
      members: [{ name: 'Owner', emoji: '⛷️' }],
    })

    const guest = await newUser()
    await expect(as(guest, 'select app_snow_window.join_crew($1)', [code])).rejects.toThrow(/no_profile/)
    const members = []
    for (let i = 0; i < 19; i++) {
      const u = await newUser(`p${i}`)
      await as(u, 'select app_snow_window.join_crew($1)', [code])
      members.push(u)
    }
    await expect(as(await newUser('late'), 'select app_snow_window.join_crew($1)', [code])).rejects.toThrow(/crew_full/)

    await expect(as(members[0] as string, 'select app_snow_window.reset_invite($1)', [crew])).rejects.toThrow(/not_owner/)
    await as(owner, 'select app_snow_window.reset_invite($1)', [crew])
    await as(owner, 'select app_snow_window.remove_member($1, $2)', [crew, members[0]])
    await expect(as(members[0] as string, 'select app_snow_window.join_crew($1)', [code])).rejects.toThrow(/bad_invite/)
  })

  it('passes the crew on when the owner leaves and deletes it when the last one goes', async () => {
    const owner = await newUser('Owner')
    const laura = await newUser('Laura')
    const { crew } = await crewWith(owner, laura)
    await as(owner, 'select app_snow_window.leave_crew($1)', [crew])
    await as(laura, "select app_snow_window.rename_crew($1, 'Laura''s crew')", [crew])
    await as(laura, 'select app_snow_window.leave_crew($1)', [crew])
    expect((await db.query('select * from app_snow_window.crews')).rows).toEqual([])
  })

  it('keeps free days inside the season, one calendar per person', async () => {
    const juho = await newUser('Juho')
    await as(juho, "select app_snow_window.set_days('{2027-01-02,2027-01-02,2026-12-31}')")
    expect(await as(juho, 'select app_snow_window.get_profile()')).toMatchObject({ days: ['2026-12-31', '2027-01-02'] })
    await expect(as(juho, "select app_snow_window.set_days('{2027-06-01}')")).rejects.toThrow(/day_outside_season/)
  })
})

describe('trips', () => {
  it('lets members answer, only the proposer change status, and clears a removed member', async () => {
    const owner = await newUser('Owner')
    const laura = await newUser('Laura')
    const outsider = await newUser('Out')
    const { crew } = await crewWith(owner, laura)
    const trip = await as<string>(laura, 'select app_snow_window.create_trip($1, $2, $3, $4, $5, null)', [
      crew, 'grandvalira', '2026-12-28', '2026-12-31', 'New Year',
    ])
    await as(owner, "select app_snow_window.respond($1, 'maybe')", [trip])
    await expect(as(outsider, "select app_snow_window.respond($1, 'yes')", [trip])).rejects.toThrow(/not_member/)
    await expect(as(owner, "select app_snow_window.set_trip_status($1, 'on')", [trip])).rejects.toThrow(/not_your_trip/)

    expect(await as(owner, 'select app_snow_window.get_crew($1)', [crew])).toMatchObject({
      trips: [{ title: 'New Year', responses: { [laura]: 'yes', [owner]: 'maybe' } }],
    })

    await as(laura, "select app_snow_window.set_trip_status($1, 'cancelled')", [trip])
    await expect(as(owner, "select app_snow_window.respond($1, 'yes')", [trip])).rejects.toThrow(/trip_closed/)

    await expect(as(laura, 'select app_snow_window.remove_member($1, $2)', [crew, owner])).rejects.toThrow(/not_owner/)
    await as(owner, 'select app_snow_window.remove_member($1, $2)', [crew, laura])
    expect(await as(owner, 'select app_snow_window.get_crew($1)', [crew])).toMatchObject({ trips: [] })
  })

  it('stops at 40 trips per crew', async () => {
    const owner = await newUser('Owner')
    const { crew } = await crewWith(owner)
    const add = () => as<string>(owner, "select app_snow_window.create_trip($1, 'cerler', '2027-02-01', '2027-02-01', null, null)", [crew])
    for (let i = 0; i < 40; i++) await add()
    await expect(add()).rejects.toThrow(/trips_full/)
  })
})

describe('stays', () => {
  it('open once the trip is on: anyone adds, votes and books; only adder or proposer removes', async () => {
    const owner = await newUser('Owner')
    const laura = await newUser('Laura')
    const outsider = await newUser('Out')
    const { crew } = await crewWith(owner, laura)
    const trip = await as<string>(owner, "select app_snow_window.create_trip($1, 'baqueira', '2027-01-08', '2027-01-10', null, null)", [crew])
    const options = JSON.stringify([
      { name: 'Hotel Tuca', url: 'https://example.com/tuca', price: 60, why: 'At the lift' },
      { name: 'Flat in Vielha', url: null, price: null, why: null },
    ])
    await expect(as(laura, 'select app_snow_window.add_stays($1, $2)', [trip, options])).rejects.toThrow(/trip_not_on/)
    await as(owner, "select app_snow_window.set_trip_status($1, 'on')", [trip])
    await expect(as(outsider, 'select app_snow_window.add_stays($1, $2)', [trip, options])).rejects.toThrow(/not_member/)

    await as(laura, 'select app_snow_window.add_stays($1, $2)', [trip, options])
    await as(laura, 'select app_snow_window.set_stay_prefs($1, 50, true)', [trip])
    const stay = async (name: string) => as<string>(owner, 'select id from app_snow_window.stays where name = $1', [name])
    const tuca = await stay('Hotel Tuca')
    const flat = await stay('Flat in Vielha')
    await as(owner, 'select app_snow_window.vote_stay($1, true)', [tuca])
    await as(laura, 'select app_snow_window.vote_stay($1, true)', [tuca])
    await as(laura, 'select app_snow_window.vote_stay($1, false)', [tuca])
    await as(owner, 'select app_snow_window.book_stay($1, $2)', [trip, tuca])
    expect(await as(owner, 'select app_snow_window.get_crew($1)', [crew])).toMatchObject({
      trips: [{ stayBudget: 50, driving: true, bookedStay: tuca, stays: [{ name: 'Hotel Tuca', price: 60, votes: [owner] }, { name: 'Flat in Vielha' }] }],
    })

    const stranger = await newUser('Stranger')
    const code = await as<string>(owner, 'select invite_code from app_snow_window.crews where id = $1', [crew])
    await as(stranger, 'select app_snow_window.join_crew($1)', [code])
    await expect(as(stranger, 'select app_snow_window.remove_stay($1)', [flat])).rejects.toThrow(/not_your_stay/)
    await as(owner, 'select app_snow_window.remove_stay($1)', [tuca])
    expect(await as(owner, 'select booked_stay from app_snow_window.trips where id = $1', [trip])).toBeNull()

    const many = JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ name: `Place ${i}` })))
    await expect(as(laura, 'select app_snow_window.add_stays($1, $2)', [trip, many])).rejects.toThrow(/stays_full/)

    const day = await as<string>(owner, "select app_snow_window.create_trip($1, 'cerler', '2027-02-01', '2027-02-01', null, null)", [crew])
    await as(owner, "select app_snow_window.set_trip_status($1, 'on')", [day])
    await expect(as(owner, 'select app_snow_window.set_stay_prefs($1, 40, null)', [day])).rejects.toThrow(/day_trip_no_stay/)
  })
})

describe('cars', () => {
  it('open once the trip is on: offer, claim, full, move, leave, remove, and a leaver takes theirs along', async () => {
    const owner = await newUser('Owner')
    const laura = await newUser('Laura')
    const ben = await newUser('Ben')
    const outsider = await newUser('Out')
    const { crew } = await crewWith(owner, laura, ben)
    const trip = await as<string>(owner, "select app_snow_window.create_trip($1, 'cerler', '2027-02-01', '2027-02-01', null, null)", [crew])
    await expect(as(laura, "select app_snow_window.offer_car($1, 2, null)", [trip])).rejects.toThrow(/trip_not_on/)
    await as(owner, "select app_snow_window.set_trip_status($1, 'on')", [trip])
    await expect(as(outsider, "select app_snow_window.offer_car($1, 2, null)", [trip])).rejects.toThrow(/not_member/)
    await expect(as(laura, "select app_snow_window.offer_car($1, 9, null)", [trip])).rejects.toThrow(/bad_seats/)

    const small = await as<string>(laura, "select app_snow_window.offer_car($1, 1, ' Leaves 7am ')", [trip])
    await expect(as(laura, "select app_snow_window.offer_car($1, 2, null)", [trip])).rejects.toThrow(/car_exists/)
    const big = await as<string>(owner, 'select app_snow_window.offer_car($1, 3, null)', [trip])
    await expect(as(laura, 'select app_snow_window.claim_seat($1)', [small])).rejects.toThrow(/own_car/)

    await as(ben, 'select app_snow_window.claim_seat($1)', [small])
    await expect(as(laura, 'select app_snow_window.claim_seat($1)', [big])).rejects.toThrow(/own_car/)
    await expect(as(owner, 'select app_snow_window.claim_seat($1)', [small])).rejects.toThrow(/own_car/)
    // Drivers never take seats; Ben holds small's only seat.
    const seated = async () =>
      (await as<{ trips: { cars: { id: string; riders: string[]; note: string | null }[] }[] }>(owner, 'select app_snow_window.get_crew($1)', [crew])).trips[0]?.cars
    expect((await seated())?.find((c) => c.id === small)).toMatchObject({ riders: [ben], note: 'Leaves 7am' })

    const late = await newUser('Late')
    const code = await as<string>(owner, 'select invite_code from app_snow_window.crews where id = $1', [crew])
    await as(late, 'select app_snow_window.join_crew($1)', [code])
    await expect(as(late, 'select app_snow_window.claim_seat($1)', [small])).rejects.toThrow(/car_full/)

    // Moving: Ben takes a seat in the big car and frees the small one.
    await as(ben, 'select app_snow_window.claim_seat($1)', [big])
    expect((await seated())?.find((c) => c.id === small)?.riders).toEqual([])
    expect((await seated())?.find((c) => c.id === big)?.riders).toEqual([ben])
    await as(late, 'select app_snow_window.claim_seat($1)', [small])

    await as(ben, 'select app_snow_window.leave_seat($1)', [big])
    expect((await seated())?.find((c) => c.id === big)?.riders).toEqual([])
    await expect(as(ben, 'select app_snow_window.remove_car($1)', [small])).rejects.toThrow(/not_your_car/)

    await as(owner, 'select app_snow_window.remove_member($1, $2)', [crew, late])
    expect((await seated())?.find((c) => c.id === small)?.riders).toEqual([])
    await as(owner, 'select app_snow_window.remove_member($1, $2)', [crew, laura])
    expect((await seated())?.map((c) => c.id)).toEqual([big])
    await as(owner, 'select app_snow_window.remove_car($1)', [big])
    expect(await seated()).toEqual([])
  })
})

describe('regions and home city', () => {
  it('accepts every resort id the app lists and refuses unknown ones', async () => {
    const { RESORTS } = await import('../src/config/resorts')
    const sql = (await import('node:fs')).readFileSync(new URL(`../supabase/migrations/${'20261128120000_app_snow_window__regions.sql'}`, import.meta.url), 'utf8')
    const listed = [...(sql.match(/resort_id in\s*\(([^)]*)\)/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(listed.sort()).toEqual(RESORTS.map((r) => r.id).sort())
    expect((await db.query("select conname from pg_constraint where conname = 'trips_resort_id_check'")).rows).toHaveLength(1)

    const juho = await newUser('Juho')
    const { crew } = await crewWith(juho)
    await as(juho, 'select app_snow_window.create_trip($1, $2, $3, $4, null, null)', [crew, 'ruka', '2027-02-01', '2027-02-01'])
    await expect(
      as(juho, 'select app_snow_window.create_trip($1, $2, $3, $4, null, null)', [crew, 'mordor', '2027-02-01', '2027-02-01']),
    ).rejects.toThrow(/trips_resort_id_check/)
  })

  it('stores a home city by its shape, clears it with null, and returns it with the crew', async () => {
    const juho = await newUser('Juho')
    const laura = await newUser('Laura')
    const { crew } = await crewWith(juho, laura)
    await as(juho, "select app_snow_window.set_home_city('andorra-la-vella')")
    for (const bad of ['Barcelona', '', 'a b', 'x'.repeat(41)])
      await expect(as(juho, 'select app_snow_window.set_home_city($1)', [bad])).rejects.toThrow(/bad_city/)
    expect(await as(laura, 'select app_snow_window.get_crew($1)', [crew])).toMatchObject({
      people: [{ name: 'Juho', homeCity: 'andorra-la-vella' }, { name: 'Laura', homeCity: null }],
    })
    expect(await as(juho, 'select app_snow_window.get_profile()')).toMatchObject({ homeCity: 'andorra-la-vella' })
    await as(juho, 'select app_snow_window.set_home_city(null)')
    expect(await as(juho, 'select app_snow_window.get_profile()')).toMatchObject({ homeCity: null })
  })

  it('lets any member set a crew\'s areas: at least one, known, deduped and in a stable order', async () => {
    const juho = await newUser('Juho')
    const laura = await newUser('Laura')
    const outsider = await newUser('Out')
    const { crew } = await crewWith(juho, laura)
    const regions = async () => ((await as<{ regions: string[] }[]>(juho, 'select app_snow_window.my_crews()'))[0] as { regions: string[] }).regions
    expect(await regions()).toEqual(['spain'])
    await as(laura, "select app_snow_window.set_crew_regions($1, '{sweden,alps,sweden}')", [crew])
    expect(await regions()).toEqual(['alps', 'sweden'])
    await expect(as(juho, "select app_snow_window.set_crew_regions($1, '{}')", [crew])).rejects.toThrow(/bad_regions/)
    await expect(as(juho, "select app_snow_window.set_crew_regions($1, '{alps,norway}')", [crew])).rejects.toThrow(/bad_regions/)
    await expect(as(juho, 'select app_snow_window.set_crew_regions($1, null)', [crew])).rejects.toThrow(/bad_regions/)
    await expect(as(outsider, "select app_snow_window.set_crew_regions($1, '{alps}')", [crew])).rejects.toThrow(/not_member/)
    expect(await regions()).toEqual(['alps', 'sweden'])
  })
})
