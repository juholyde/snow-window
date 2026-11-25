import { describe, expect, it, vi } from 'vitest'
import { loadForecasts, parseForecast, weatherKind } from '../src/lib/weather'

const resort = (id: string) => ({ id, name: id, lat: 42, lon: 1, elevation: 2000 })
const place = (snow: number) => ({
  daily: {
    time: ['2026-12-01', '2026-12-02'],
    weather_code: [73, null],
    temperature_2m_max: [-1.6, 2],
    temperature_2m_min: [-7.2, -3],
    snowfall_sum: [snow, 0],
  },
})
const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

it('maps WMO codes to the kinds the board draws', () => {
  expect([0, 2, 3, 48, 61, 75, 86, 95].map(weatherKind)).toEqual([
    'sun', 'partly', 'cloud', 'fog', 'rain', 'snow', 'snow', 'storm',
  ])
})

describe('parseForecast', () => {
  it('keys each place by resort in request order and skips days without data', () => {
    const f = parseForecast([place(12.4), place(0)], [resort('a'), resort('b')])
    expect(f.a?.['2026-12-01']).toEqual({ day: '2026-12-01', kind: 'snow', tMax: -2, tMin: -7, snowCm: 12 })
    expect(f.a?.['2026-12-02']).toBeUndefined()
    expect(f.b?.['2026-12-01']?.snowCm).toBe(0)
  })

  it('accepts the single-object answer for one place and refuses a mismatch', () => {
    expect(Object.keys(parseForecast(place(1), [resort('a')]))).toEqual(['a'])
    expect(() => parseForecast([place(1)], [resort('a'), resort('b')])).toThrow(/2/)
  })
})

describe('loadForecasts', () => {
  it('fetches at most every 30 minutes and falls back to the last good forecast', async () => {
    const storage = memory()
    const ok = vi.fn(async () => new Response(JSON.stringify(place(5))))
    await loadForecasts([resort('a')], storage, ok as typeof fetch, 0)
    await loadForecasts([resort('a')], storage, ok as typeof fetch, 10 * 60_000)
    expect(ok).toHaveBeenCalledTimes(1)

    const down = vi.fn(async () => new Response('', { status: 503 }))
    const later = await loadForecasts([resort('a')], storage, down as typeof fetch, 60 * 60_000)
    expect(down).toHaveBeenCalledTimes(1)
    expect(later.a?.['2026-12-01']?.snowCm).toBe(5)
    await expect(loadForecasts([resort('a')], memory(), down as typeof fetch)).rejects.toThrow(/503/)
  })
})
