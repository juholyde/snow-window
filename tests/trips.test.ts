import { describe, expect, it } from 'vitest'
import type { Person } from '../src/lib/overlap'
import { LocalStore } from '../src/lib/store'
import { cleanDraft, coverage, sortTrips, type Trip, type TripDraft, tally } from '../src/lib/trips'

const person = (id: string, days: string[]): Person => ({ id, name: id, emoji: '🏂', days })
const draft = (over: Partial<TripDraft> = {}): TripDraft => ({
  resortId: 'baqueira',
  start: '2027-03-26',
  end: '2027-03-29',
  title: '',
  note: '',
  stayUrl: 'https://example.com/flat',
  stayPrice: 45,
  stayNote: '',
  ...over,
})
const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('cleanDraft', () => {
  it('drops the stay on a day trip and refuses what the database would', () => {
    expect(cleanDraft(draft({ end: '2027-03-26' }))).toMatchObject({ stayUrl: '', stayPrice: null })
    expect(() => cleanDraft(draft({ stayUrl: 'javascript:alert(1)' }))).toThrow(/https/)
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
    id, proposerId: 'a', resortId: 'cerler', start: '2027-01-02', end: '2027-01-02', title: null, note: null,
    stayUrl: null, stayPrice: null, stayNote: null, status, createdAt, responses: { a: 'yes', b: 'no' },
  })
  const people = [person('a', []), person('b', []), person('c', [])]
  const result = tally(t('x', 'open', '1'), people)
  expect([result.yes, result.no, result.none].map((g) => g.map((p) => p.id))).toEqual([['a'], ['b'], ['c']])
  expect(sortTrips([t('1', 'cancelled', '3'), t('2', 'open', '1'), t('3', 'on', '0'), t('4', 'open', '2')]).map((x) => x.id))
    .toEqual(['3', '4', '2', '1'])
})

describe('LocalStore trips', () => {
  it('needs your token, lets only the proposer close, and removes trips with their person', async () => {
    const store = new LocalStore(memory())
    const me = await store.addPerson('Juho', '🏂')
    const laura = await store.addPerson('Laura', '⛷️')
    const id = await store.createTrip(me.person.id, me.token, draft())
    await expect(store.respond(id, laura.person.id, me.token, 'yes')).rejects.toThrow(/own row/)
    await store.respond(id, laura.person.id, laura.token, 'maybe')
    await expect(store.setTripStatus(id, laura.person.id, laura.token, 'on')).rejects.toThrow(/suggested/)
    await store.setTripStatus(id, me.person.id, me.token, 'on')
    expect((await store.loadTrips())[0]).toMatchObject({
      status: 'on',
      responses: { [me.person.id]: 'yes', [laura.person.id]: 'maybe' },
    })
    await store.removePerson(me.person.id, me.token)
    expect(await store.loadTrips()).toEqual([])
  })
})
