import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../supabase/migrations/20261125120000_app_snow_window__init.sql', import.meta.url),
  'utf8',
)

// Just enough of the sandbox platform for the migration to run.
const platformStub = `
  create role anon; create role authenticated; create role service_role;
  create schema platform;
  create table platform.apps (slug text primary key, name text, join_mode text, redirect_urls text[]);
  create function platform.gate_tables(slug text) returns void language sql as 'select';
`

let db: PGlite

async function asAnon<T>(sql: string, params: unknown[] = []): Promise<T> {
  await db.exec('set role anon')
  try {
    const res = await db.query<{ r: T }>(sql, params)
    return res.rows[0]?.r as T
  } finally {
    await db.exec('reset role')
  }
}

const add = (name: string) =>
  asAnon<{ id: string; token: string }>('select app_snow_window.add_person($1, $2) r', [name, '⛷️'])

beforeEach(async () => {
  db = new PGlite()
  await db.exec(platformStub)
  await db.exec(migration)
})

describe('snow_window migration, as an anonymous visitor', () => {
  it('keeps the people table itself out of reach', async () => {
    await expect(asAnon('select token r from app_snow_window.people')).rejects.toThrow(/permission denied/)
  })

  it('shows the board without edit tokens', async () => {
    await add('  Juho   L ')
    const board = await asAnon<Array<Record<string, unknown>>>('select app_snow_window.get_board() r')
    expect(board).toEqual([{ id: expect.any(String), name: 'Juho L', emoji: '⛷️', days: [] }])
  })

  it('stops at 20 people', async () => {
    for (let i = 0; i < 20; i++) await add(`p${i}`)
    await expect(add('one too many')).rejects.toThrow(/board_full/)
  })

  it('lets only the token holder change or remove a row', async () => {
    const me = await add('Juho')
    const other = await add('Laura')
    await asAnon("select app_snow_window.set_days($1, $2, '{2027-01-02,2027-01-02,2026-12-31}') r", [
      me.id,
      me.token,
    ])
    await expect(
      asAnon("select app_snow_window.set_days($1, $2, '{2027-01-02}') r", [other.id, me.token]),
    ).rejects.toThrow(/not_your_row/)
    await expect(asAnon('select app_snow_window.remove_person($1, $2) r', [other.id, me.token])).rejects.toThrow(
      /not_your_row/,
    )
    const board = await asAnon<Array<{ name: string; days: string[] }>>('select app_snow_window.get_board() r')
    expect(board.map((p) => [p.name, p.days])).toEqual([
      ['Juho', ['2026-12-31', '2027-01-02']],
      ['Laura', []],
    ])
  })

  it('refuses days outside the season', async () => {
    const me = await add('Juho')
    await expect(
      asAnon("select app_snow_window.set_days($1, $2, '{2027-05-01}') r", [me.id, me.token]),
    ).rejects.toThrow(/day_outside_season/)
  })
})
