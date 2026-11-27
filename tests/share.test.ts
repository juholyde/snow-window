import { describe, expect, it } from 'vitest'
import { inviteMessage, tripSummary } from '../src/lib/share'
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
