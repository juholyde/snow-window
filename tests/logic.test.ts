import { describe, expect, it } from 'vitest'
import { countByDay, findWindows, markDay, type Person, stretchPicks } from '../src/lib/overlap'
import { cleanDays } from '../src/lib/rules'
import { modeFor, paint, span, tapRange } from '../src/lib/selection'
import { inviteLink, LocalStore, parseInvite } from '../src/lib/store'

const person = (name: string, days: string[]): Person => ({ id: name, name, emoji: '🏂', days, homeCity: null })
const memory = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
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

describe('LocalStore crews', () => {
  it('joins by invite up to 20 people and passes the crew on when its owner leaves', async () => {
    const storage = memory()
    const owner = new LocalStore(storage, 'owner')
    await expect(owner.createCrew('Gang')).rejects.toThrow(/name and an emoji/)
    await owner.saveProfile(' Juho ', '⛷️')
    const crewId = await owner.createCrew('  Pyrenees   gang ')
    const [crew] = await owner.crews()
    expect(crew).toMatchObject({ name: 'Pyrenees gang', ownerId: 'owner', members: 1 })

    const laura = new LocalStore(storage, 'laura')
    await laura.saveProfile('Laura', '🏂')
    await laura.joinCrew(crew?.inviteCode ?? '')
    await laura.setDays(['2027-01-03', '2027-01-02'])
    expect((await owner.loadCrew(crewId)).people.map((p) => [p.name, p.days])).toEqual([
      ['Juho', []],
      ['Laura', ['2027-01-02', '2027-01-03']],
    ])
    await expect(laura.renameCrew(crewId, 'Mine')).rejects.toThrow(/made the crew/)

    for (let i = 0; i < 18; i++) {
      const p = new LocalStore(storage, `p${i}`)
      await p.saveProfile(`p${i}`, '🎿')
      await p.joinCrew(crew?.inviteCode ?? '')
    }
    const late = new LocalStore(storage, 'late')
    await late.saveProfile('Late', '🐢')
    await expect(late.joinCrew(crew?.inviteCode ?? '')).rejects.toThrow(/full/)

    await owner.leaveCrew(crewId)
    expect((await laura.crews())[0]?.ownerId).toBe('laura')
  })
})

it('round-trips an invite link', () => {
  const code = crypto.randomUUID()
  const link = inviteLink('https://x.test/snow-window/#old', code)
  expect(link).toBe(`https://x.test/snow-window/#join=${code}`)
  expect(parseInvite(new URL(link).hash)).toBe(code)
  expect(parseInvite('#join=nope')).toBeNull()
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
