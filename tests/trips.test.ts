import { describe, expect, it } from 'vitest'
import type { Person } from '../src/lib/overlap'
import { LocalStore } from '../src/lib/store'
import { cleanDraft, coverage, parseStays, sortTrips, stayPrompt, type Trip, type TripDraft, tally } from '../src/lib/trips'

const person = (id: string, days: string[]): Person => ({ id, name: id, emoji: '🏂', days })
const draft = (over: Partial<TripDraft> = {}): TripDraft => ({
  resortId: 'baqueira',
  start: '2027-03-26',
  end: '2027-03-29',
  title: '',
  note: '',
  ...over,
})
const memory = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't', proposerId: 'a', resortId: 'cerler', start: '2027-01-02', end: '2027-01-02', title: null, note: null,
  status: 'open', createdAt: '0', responses: {}, stayBudget: null, driving: null, stays: [], bookedStay: null, ...over,
})

describe('stay prompt and paste', () => {
  it('asks for STAY lines with the trip, crew and wishes in it', () => {
    const t = trip({ resortId: 'baqueira', start: '2027-01-08', end: '2027-01-10', note: 'sauna please',
      stayBudget: 50, driving: false, responses: { a: 'yes', b: 'maybe', c: 'no' } })
    const prompt = stayPrompt(t, [person('a', []), person('b', []), person('c', [])])
    expect(prompt).toContain('Baqueira')
    expect(prompt).toContain('2 nights')
    expect(prompt).toContain('2 people')
    expect(prompt).toContain('€50')
    expect(prompt).toContain('No car')
    expect(prompt).toContain('sauna please')
    expect(prompt).toContain('STAY | name |')
  })

  it('reads STAY lines out of a chatty answer, tolerating markdown, € signs and decimal commas', () => {
    const answer = [
      'Here are three options:',
      '```',
      'STAY | Hotel Tuca | https://example.com/tuca | €62,50 | Ski-in, ski-out',
      '- stay | Flat in Vielha | [book](https://example.com/vielha) | 38 | Cheap, 15 min drive | sleeps 6',
      'STAY | Refugi | no link | ? |',
      '```',
      'Enjoy!',
    ].join('\n')
    expect(parseStays(answer)).toEqual([
      { name: 'Hotel Tuca', url: 'https://example.com/tuca', price: 63, why: 'Ski-in, ski-out' },
      { name: 'Flat in Vielha', url: 'https://example.com/vielha', price: 38, why: 'Cheap, 15 min drive | sleeps 6' },
      { name: 'Refugi', url: null, price: null, why: null },
    ])
    expect(() => parseStays('Sorry, I cannot browse.')).toThrow(/STAY/)
  })
})

describe('cleanDraft', () => {
  it('refuses what the database would', () => {
    expect(() => cleanDraft(draft({ end: '2027-04-20' }))).toThrow(/at most/)
    expect(() => cleanDraft(draft({ end: '2027-03-20' }))).toThrow(/before/)
    expect(() => cleanDraft(draft({ resortId: 'nowhere' }))).toThrow(/resort/)
  })
})

it('splits people into free for the whole trip and missing some of it, ignoring empty rows', () => {
  const people = [
    person('a', ['2027-03-26', '2027-03-27']),
    person('b', ['2027-03-26']),
    person('c', []),
  ]
  const c = coverage({ start: '2027-03-26', end: '2027-03-27' }, people)
  expect([c.free.map((p) => p.id), c.miss.map((p) => p.id)]).toEqual([['a'], ['b']])
})

it('tallies answers with everyone else as not answered, and sorts on > open > cancelled', () => {
  const t = (id: string, status: Trip['status'], createdAt: string): Trip => ({
    ...trip(), id, status, createdAt, responses: { a: 'yes', b: 'no' },
  })
  const people = [person('a', []), person('b', []), person('c', [])]
  const result = tally(t('x', 'open', '1'), people)
  expect([result.yes, result.no, result.none].map((g) => g.map((p) => p.id))).toEqual([['a'], ['b'], ['c']])
  expect(sortTrips([t('1', 'cancelled', '3'), t('2', 'open', '1'), t('3', 'on', '0'), t('4', 'open', '2')]).map((x) => x.id))
    .toEqual(['3', '4', '2', '1'])
})

describe('LocalStore trips', () => {
  it('lets members answer, only the proposer close, and drops a removed member\'s trips', async () => {
    const storage = memory()
    const me = new LocalStore(storage, 'me')
    const laura = new LocalStore(storage, 'laura')
    const outsider = new LocalStore(storage, 'out')
    for (const [s, n] of [[me, 'Juho'], [laura, 'Laura'], [outsider, 'Out']] as const) await s.saveProfile(n, '🏂')
    const crewId = await me.createCrew('Gang')
    await laura.joinCrew((await me.crews())[0]?.inviteCode ?? '')

    const mine = await me.createTrip(crewId, draft())
    const hers = await laura.createTrip(crewId, draft({ title: 'Hers' }))
    await laura.respond(mine, 'maybe')
    await expect(outsider.respond(mine, 'yes')).rejects.toThrow(/not in that crew/)
    await expect(laura.setTripStatus(mine, 'on')).rejects.toThrow(/suggested/)
    await me.setTripStatus(mine, 'on')
    const trips = (await me.loadCrew(crewId)).trips
    expect(trips.find((t) => t.id === mine)).toMatchObject({ status: 'on', responses: { me: 'yes', laura: 'maybe' } })

    await me.removeMember(crewId, 'laura')
    const left = (await me.loadCrew(crewId)).trips
    expect(left.map((t) => t.id)).toEqual([mine])
    expect(left[0]?.responses).toEqual({ me: 'yes' })
    expect(left.some((t) => t.id === hers)).toBe(false)
  })
})
