import { describe, expect, it } from 'vitest'
import { countByDay, findWindows, markDay, type Person, stretchPicks } from '../src/lib/overlap'
import { cleanDays } from '../src/lib/rules'
import { modeFor, paint, span, tapRange } from '../src/lib/selection'
import { claimLink, LocalStore, parseClaim } from '../src/lib/store'

const person = (name: string, days: string[]): Person => ({ id: name, name, emoji: '🏂', days })
const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('findWindows', () => {
  const season = { start: '2027-03-20', end: '2027-03-31' }
  const counts = countByDay([
    person('a', ['2027-03-25', '2027-03-26', '2027-03-27', '2027-03-28', '2027-03-30']),
    person('b', ['2027-03-26', '2027-03-27', '2027-03-28', '2027-03-30']),
  ])

  it('finds runs where everyone is free, longest first, with what they cover', () => {
    expect(findWindows(season, counts, 2)).toEqual([
      { start: '2027-03-26', end: '2027-03-28', length: 3, people: 2, weekendDays: 2, holidays: ['Good Friday'], keyDates: [] },
      { start: '2027-03-30', end: '2027-03-30', length: 1, people: 2, weekendDays: 0, holidays: [], keyDates: [] },
    ])
  })

  it('reports the fewest people free across a looser window', () => {
    expect(findWindows(season, counts, 1)[0]).toMatchObject({ start: '2027-03-25', length: 4, people: 1 })
  })
})

describe('paint', () => {
  it('fills or clears every day between anchor and pointer, in either direction', () => {
    const days = ['2027-01-02']
    expect(modeFor(days, '2027-01-04')).toBe('add')
    expect(paint(days, '2027-01-04', '2027-01-01', 'add')).toEqual([
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
      '2027-01-04',
    ])
    expect(paint(['2027-01-01', '2027-01-02', '2027-01-05'], '2027-01-01', '2027-01-03', 'remove')).toEqual([
      '2027-01-05',
    ])
  })
})

it('marks weekends, holidays and key dates', () => {
  expect(markDay('2026-12-26')).toEqual({ weekend: true, holiday: 'Sant Esteve (Catalonia)' })
  expect(markDay('2026-12-29')).toEqual({ weekend: false, keyDate: 'Scopely winter break' })
})

it('rejects days outside the season or malformed', () => {
  expect(() => cleanDays(['2027-05-01'])).toThrow(/outside/)
  expect(() => cleanDays(['2027-02-30'])).toThrow(/Not a date/)
})

describe('LocalStore', () => {
  it('needs the token to edit and stops at 20 people', async () => {
    const store = new LocalStore(memory())
    const { person: me, token } = await store.addPerson(' Juho ', '⛷️')
    await store.setDays(me.id, token, ['2027-01-03', '2027-01-02'])
    await expect(store.setDays(me.id, 'wrong', [])).rejects.toThrow(/own row/)
    expect(await store.load()).toEqual([{ ...me, name: 'Juho', days: ['2027-01-02', '2027-01-03'] }])
    for (let i = 0; i < 19; i++) await store.addPerson(`p${i}`, '🎿')
    await expect(store.addPerson('extra', '🎿')).rejects.toThrow(/full/)
  })
})

it('round-trips a claim link', () => {
  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  const link = claimLink('https://x.test/snow-window/#old', id, token)
  expect(parseClaim(new URL(link).hash)).toEqual({ id, token })
  expect(parseClaim('#claim=nope')).toBeNull()
})

it('picks trip dates by tapping a first and a last day, capped at the trip limit', () => {
  const one = tapRange(null, '2027-01-10', 14)
  expect(one).toEqual({ start: '2027-01-10', end: '2027-01-10' })
  expect(tapRange(one, '2027-01-12', 14)).toEqual({ start: '2027-01-10', end: '2027-01-12' })
  // A tap before the start, or after a finished range, starts over.
  expect(tapRange(one, '2027-01-08', 14)).toEqual({ start: '2027-01-08', end: '2027-01-08' })
  expect(tapRange({ start: '2027-01-10', end: '2027-01-12' }, '2027-01-20', 14).end).toBe('2027-01-20')
  expect(tapRange(one, '2027-03-01', 14)).toEqual({ start: '2027-01-10', end: '2027-01-23' })
  expect(span('2027-01-05', '2027-01-02', 14)).toEqual({ start: '2027-01-02', end: '2027-01-05' })
})

it('offers stretch picks with the most people free first and never overlapping', () => {
  const season = { start: '2027-01-01', end: '2027-01-31' }
  const counts = new Map([
    ['2027-01-02', 3], ['2027-01-03', 2], ['2027-01-04', 2], ['2027-01-10', 2], ['2027-01-20', 1],
  ])
  const picks = stretchPicks(season, counts, 3)
  expect(picks.map((w) => [w.start, w.end, w.people])).toEqual([
    ['2027-01-02', '2027-01-02', 3],
    ['2027-01-10', '2027-01-10', 2],
  ])
})
