import { describe, expect, it } from 'vitest'
import { inviteMessage, nudgeMessage, tripSummary } from '../src/lib/share'
import { cardFilename, cardLayout } from '../src/lib/shareCard'
import type { Trip } from '../src/lib/trips'

const p = (id: string, emoji: string) => ({ id, name: id, emoji, days: [] })
const people = [p('Ana', '🏂'), p('Bo', '⛷️'), p('Cy', '🎿')]
const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't', proposerId: 'Ana', resortId: 'cerler', start: '2027-01-02', end: '2027-01-05', title: null, note: null,
  status: 'on', createdAt: '0', responses: { Ana: 'yes', Bo: 'maybe', Cy: 'no' }, stayBudget: null, driving: null,
  stays: [], bookedStay: null, ...over,
})
const URL = 'https://x.test/#join=abc'

describe('trip summary', () => {
  it('lists dates, resort, going, maybe and the crew link, and omits a missing stay', () => {
    const s = tripSummary(trip(), people, 'Pyrenees Pals', URL)
    expect(s).toContain('2027')
    expect(s).toContain('3 nights')
    expect(s).toContain('Going: 🏂 Ana')
    expect(s).toContain('Maybe: ⛷️ Bo')
    expect(s).not.toContain('Cy')
    expect(s).not.toContain('Stay:')
    expect(s.endsWith(`Board for Pyrenees Pals: ${URL}`)).toBe(true)
    expect(s.split('\n').slice(0, -1).join('\n')).not.toMatch(/[*#_]/)
  })
  it('adds the booked stay and drops Maybe when empty', () => {
    const stays = [{ id: 's', addedBy: 'Ana', name: 'Hotel Sol', url: 'https://sol.test', price: 50, why: null, votes: [] }]
    const s = tripSummary(trip({ stays, bookedStay: 's', responses: { Ana: 'yes' } }), people, 'C', URL)
    expect(s).toContain('Stay: Hotel Sol https://sol.test')
    expect(s).not.toContain('Maybe')
  })
})

describe('invite message', () => {
  it('names the crew and ends with the link', () => {
    const m = inviteMessage('Pyrenees Pals', URL)
    expect(m).toContain('Pyrenees Pals')
    expect(m.endsWith(URL)).toBe(true)
  })
})

describe('share card layout', () => {
  const many = Array.from({ length: 12 }, (_, i) => p(`Person-with-a-long-name-${i}`, '🎿'))
  it('caps Going at 8 with +N more, clips long names and titles, and keeps the credit', () => {
    const responses = Object.fromEntries(many.map((m) => [m.id, 'yes' as const]))
    const L = cardLayout(trip({ responses, title: 'x'.repeat(80) }), many)
    expect(L.going).toHaveLength(8)
    expect(L.more).toBe(4)
    expect(L.going[0]?.length ?? 0).toBeLessThanOrEqual(3 + 12)
    expect(L.heading.length).toBeLessThanOrEqual(38)
    expect(L.resortLine).toBeTruthy()
    expect(L.credit).toMatch(/^Photo: .+, .+, Wikimedia Commons$/)
  })
  it('shows the booked stay, a day-trip label and a png filename', () => {
    const stays = [{ id: 's1', name: 'Hotel Aneto', url: null, price: null, why: null, votes: [] }] as unknown as Trip['stays']
    const L = cardLayout(trip({ stays, bookedStay: 's1', end: '2027-01-02' }), people)
    expect(L.stay).toBe('Hotel Aneto')
    expect(L.dates).toContain('day trip')
    expect(cardFilename(trip())).toBe('snow-window-cerler-2027-01-02.png')
  })
})

describe('nudge message', () => {
  it('names who is waiting, the trip, and ends with the link', () => {
    const m = nudgeMessage(trip({ title: 'Baqueira weekend' }), [people[0], people[1]] as typeof people, URL)
    expect(m).toContain('🏂 Ana, ⛷️ Bo: can you answer the Baqueira weekend trip (')
    expect(m).toContain('Going / Maybe')
    expect(m.endsWith(URL)).toBe(true)
  })
  it('falls back to the resort name and a single day', () => {
    const m = nudgeMessage(trip({ start: '2027-01-02', end: '2027-01-02' }), [people[2]] as typeof people, URL)
    expect(m).toContain('Cerler trip (Sat 2 Jan)')
  })
})
