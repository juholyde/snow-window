import { describe, expect, it } from 'vitest'
import { countdownText, nextOnTrip, powderDays } from '../src/lib/countdown'
import type { DayWeather } from '../src/lib/weather'

const trip = (start: string, end: string, status: 'on' | 'open' = 'on') => ({ status, start, end })
const wx = (day: string, snowCm: number): DayWeather => ({ day, kind: 'snow', tMax: 0, tMin: -5, snowCm })

describe('countdownText', () => {
  const t = { start: '2026-12-10', end: '2026-12-12' }
  it('words the edges', () => {
    expect(countdownText(t, '2026-12-01')).toBe('In 9 days')
    expect(countdownText(t, '2026-12-09')).toBe('Tomorrow')
    expect(countdownText(t, '2026-12-10')).toBe('On now (day 1 of 3)')
    expect(countdownText(t, '2026-12-12')).toBe('On now (day 3 of 3)')
    expect(countdownText(t, '2026-12-13')).toBeNull()
  })
  it('says Today! for a one-day trip starting today', () => {
    expect(countdownText({ start: '2026-12-10', end: '2026-12-10' }, '2026-12-10')).toBe('Today!')
  })
})

describe('nextOnTrip', () => {
  it('picks the earliest on trip that is not over', () => {
    const trips = [trip('2026-12-20', '2026-12-22'), trip('2026-12-01', '2026-12-03'), trip('2026-12-12', '2026-12-14', 'open'), trip('2026-12-15', '2026-12-16')]
    expect(nextOnTrip(trips, '2026-12-05')?.start).toBe('2026-12-15')
    expect(nextOnTrip(trips, '2026-12-03')?.start).toBe('2026-12-01')
    expect(nextOnTrip(trips, '2026-12-30')).toBeNull()
  })
})

describe('powderDays', () => {
  const forecast = { '2026-12-10': wx('2026-12-10', 2), '2026-12-11': wx('2026-12-11', 5), '2026-12-12': wx('2026-12-12', 14) }
  it('lists covered days with 5 cm+ highlighted', () => {
    const d = powderDays({ start: '2026-12-10', end: '2026-12-13' }, forecast, '2026-12-01')
    expect(d.map((x) => [x.day, x.cm, x.fresh])).toEqual([
      ['2026-12-10', 2, false],
      ['2026-12-11', 5, true],
      ['2026-12-12', 14, true],
    ])
  })
  it('skips past days and is empty with no forecast coverage', () => {
    expect(powderDays({ start: '2026-12-10', end: '2026-12-12' }, forecast, '2026-12-12').map((x) => x.day)).toEqual(['2026-12-12'])
    expect(powderDays({ start: '2027-01-10', end: '2027-01-12' }, forecast, '2026-12-01')).toEqual([])
    expect(powderDays({ start: '2026-12-10', end: '2026-12-12' }, null, '2026-12-01')).toEqual([])
  })
})
