import { describe, expect, it } from 'vitest'
import { CITIES } from '../src/config/cities'
import { RESORTS } from '../src/config/resorts'
import { formatHint, hint, km } from '../src/lib/distance'

const city = (id: string) => {
  const c = CITIES.find((x) => x.id === id)
  if (!c) throw new Error(`no city ${id}`)
  return c
}
const within = (actual: number, expected: number, pct: number) => Math.abs(actual - expected) / expected <= pct / 100

describe('km', () => {
  it('matches known straight-line distances within 2%', () => {
    expect(within(km(city('barcelona'), city('madrid')), 505, 2)).toBe(true)
    expect(within(km(city('helsinki'), city('stockholm')), 395, 2)).toBe(true)
  })
})

describe('calibration on the Barcelona car data', () => {
  const bcn = city('barcelona')
  const checked = RESORTS.filter((r) => r.travel?.car)

  it('has the 7 checked resorts', () => expect(checked.length).toBeGreaterThanOrEqual(7))

  it('road km within -30%..+10% and drive minutes within 25%', () => {
    for (const r of checked) {
      const car = r.travel?.car
      const h = hint(bcn, r)
      expect(h.mode, r.id).toBe('drive')
      if (!car) continue
      expect(h.roadKm as number, `${r.id} roadKm`).toBeGreaterThanOrEqual(car.km * 0.7)
      expect(h.roadKm as number, `${r.id} roadKm`).toBeLessThanOrEqual(car.km * 1.1)
      expect(within(h.driveMinutes as number, car.minutes, 25), `${r.id} minutes`).toBe(true)
    }
  })
})

describe('fly rule', () => {
  it('flies past 950 km and across the Baltic, drives otherwise', () => {
    expect(hint(city('barcelona'), city('berlin')).mode).toBe('fly')
    expect(hint(city('helsinki'), city('stockholm')).mode).toBe('fly')
    expect(hint(city('helsinki'), city('tallinn')).mode).toBe('fly')
    expect(hint(city('oulu'), city('berlin')).mode).toBe('fly')
    expect(hint(city('helsinki'), city('tampere')).mode).toBe('drive')
    expect(hint(city('stockholm'), city('oslo')).mode).toBe('drive')
    expect(hint(city('barcelona'), city('toulouse')).mode).toBe('drive')
    // Round the Bothnian Bay by land: Oulu to Riksgränsen drives; Helsinki to Riksgränsen flies.
    const riksgransen = { lat: 68.43, lon: 18.12 }
    expect(hint(city('oulu'), riksgransen).mode).toBe('drive')
    expect(hint(city('helsinki'), riksgransen).mode).toBe('fly')
  })
})

describe('formatHint', () => {
  it('formats drive and fly', () => {
    expect(formatHint({ km: 100, mode: 'drive', roadKm: 320, driveMinutes: 250 })).toBe('320 km · ~4h 15m by car')
    expect(formatHint({ km: 2950, mode: 'fly' })).toBe('2,950 km · fly')
  })
})

describe('CITIES', () => {
  it('has unique kebab-case ASCII ids, including barcelona', () => {
    const ids = CITIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(ids).toContain('barcelona')
  })
})
