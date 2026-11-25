import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../supabase/migrations/20261125160000_app_snow_window__init.sql', import.meta.url),
  'utf8',
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
  await db.exec(migration)
})

describe('crews', () => {
  it('shows people only the crews, profiles and trips they share', async () => {
    const juho = await newUser('Juho')
    const laura = await newUser('Laura')
    const stranger = await newUser('Stranger')
    const { crew } = await crewWith(juho, laura)
    await as(laura, 'select app_snow_window.create_trip($1, $2, $3, $4, null, null, null, null, null)', [
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
    const trip = await as<string>(laura, 'select app_snow_window.create_trip($1, $2, $3, $4, $5, null, $6, $7, null)', [
      crew, 'grandvalira', '2026-12-28', '2026-12-31', 'New Year', 'https://example.com/flat', 52,
    ])
    await as(owner, "select app_snow_window.respond($1, 'maybe')", [trip])
    await expect(as(outsider, "select app_snow_window.respond($1, 'yes')", [trip])).rejects.toThrow(/not_member/)
    await expect(as(owner, "select app_snow_window.set_trip_status($1, 'on')", [trip])).rejects.toThrow(/not_your_trip/)

    expect(await as(owner, 'select app_snow_window.get_crew($1)', [crew])).toMatchObject({
      trips: [{ stayPrice: 52, responses: { [laura]: 'yes', [owner]: 'maybe' } }],
    })

    await as(laura, "select app_snow_window.set_trip_status($1, 'cancelled')", [trip])
    await expect(as(owner, "select app_snow_window.respond($1, 'yes')", [trip])).rejects.toThrow(/trip_closed/)

    await expect(as(laura, 'select app_snow_window.remove_member($1, $2)', [crew, owner])).rejects.toThrow(/not_owner/)
    await as(owner, 'select app_snow_window.remove_member($1, $2)', [crew, laura])
    expect(await as(owner, 'select app_snow_window.get_crew($1)', [crew])).toMatchObject({ trips: [] })
  })

  it('stops at 40 trips per crew and keeps day trips free of a stay', async () => {
    const owner = await newUser('Owner')
    const { crew } = await crewWith(owner)
    const add = () =>
      as<string>(owner, 'select app_snow_window.create_trip($1, $2, $3, $3, null, null, $4, $5, $6)', [
        crew, 'cerler', '2027-02-01', 'https://x.example', 30, 'flat',
      ])
    const first = await add()
    expect((await db.query('select stay_url, stay_price from app_snow_window.trips where id = $1', [first])).rows[0]).toEqual({
      stay_url: null,
      stay_price: null,
    })
    for (let i = 1; i < 40; i++) await add()
    await expect(add()).rejects.toThrow(/trips_full/)
  })
})
