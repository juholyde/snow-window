import { describe, expect, it } from 'vitest'
import { fold, icsFilename, tripIcs } from '../src/lib/ics'
import type { Trip } from '../src/lib/trips'

const people = [{ id: 'Ana', name: 'Ana', emoji: '🏂', days: [] }]
const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 'abc', proposerId: 'Ana', resortId: 'cerler', start: '2027-01-30', end: '2027-02-01', title: null, note: null,
  status: 'on', createdAt: '0', responses: { Ana: 'yes' }, stayBudget: null, driving: null,
  stays: [{ id: 's1', addedBy: 'Ana', name: 'Chalet, "Nice"; ok', url: 'https://stay.test/x', price: null, why: null, votes: [] }],
  bookedStay: 's1', ...over,
})
const make = (t = trip()) => tripIcs(t, people, 'Crew', 'https://x.test/#join=1', new Date('2027-01-01T10:20:30Z'))

describe('trip ics', () => {
  it('is a CRLF all-day event whose exclusive DTEND is the day after the last day (across a month)', () => {
    const s = make()
    expect(s.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(s.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true)
    expect(s).not.toMatch(/[^\r]\n/)
    expect(s).toContain('DTSTART;VALUE=DATE:20270130\r\n')
    expect(s).toContain('DTEND;VALUE=DATE:20270202\r\n')
    expect(s).toContain('DTSTAMP:20270101T102030Z\r\n')
    expect(s).toContain('UID:abc@snow-window\r\n')
    expect(s).toContain('URL:https://stay.test/x\r\n')
  })
  it('a one-day trip ends the next day', () => {
    expect(make(trip({ start: '2027-12-31', end: '2027-12-31' }))).toContain('DTEND;VALUE=DATE:20280101')
  })
  it('escapes TEXT and unfolds back to the original lines', () => {
    const s = make(trip({ title: 'a,b;c\\d' }))
    const flat = s.replace(/\r\n /g, '')
    expect(flat).toContain('SUMMARY:🏂 a\\,b\\;c\\\\d\r\n')
    expect(flat).toMatch(/DESCRIPTION:.*\\n.*Stay: Chalet\\, "Nice"\\; ok https:\/\/stay\.test\/x/)
  })
  it('puts the plan in the description', () => {
    const flat = make(trip({ note: 'Sauna; then tapas' })).replace(/\r\n /g, '')
    expect(flat).toMatch(/DESCRIPTION:.*\\n\\nSauna\\; then tapas\r\n/)
  })
  it('folds lines over 75 octets without splitting characters', () => {
    const enc = new TextEncoder()
    for (const l of make().split('\r\n')) expect(enc.encode(l).length).toBeLessThanOrEqual(75)
    const f = fold(`X:${'🏂'.repeat(40)}`)
    expect(f).toContain('\r\n ')
    expect(f.replace(/\r\n /g, '')).toBe(`X:${'🏂'.repeat(40)}`)
  })
  it('names the file by resort and start', () => {
    expect(icsFilename(trip())).toBe('snow-window-cerler-2027-01-30.ics')
  })
})
