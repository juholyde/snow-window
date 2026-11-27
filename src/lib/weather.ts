import type { Resort as FullResort } from '../config/resorts'

/** Weather needs only where a resort is. */
type Resort = Pick<FullResort, 'id' | 'name' | 'lat' | 'lon' | 'elevation'>
import type { Day } from './dates'

/**
 * Daily resort forecasts from Open-Meteo (free, no key). It reaches 16 days ahead;
 * days beyond that have no forecast and the row stays empty there.
 */
export const FORECAST_DAYS = 16
const CACHE_MS = 30 * 60_000

export type DayWeather = { day: Day; kind: WeatherKind; tMax: number; tMin: number; snowCm: number }
export type Forecasts = Record<string, Record<Day, DayWeather>>
export type WeatherKind = 'sun' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm'

/** WMO weather code → the few kinds the board draws. */
export function weatherKind(code: number): WeatherKind {
  if (code <= 1) return 'sun'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'rain'
}

export function forecastUrl(resorts: readonly Resort[]): string {
  const q = new URLSearchParams({
    latitude: resorts.map((r) => r.lat).join(','),
    longitude: resorts.map((r) => r.lon).join(','),
    elevation: resorts.map((r) => r.elevation).join(','),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum',
    forecast_days: String(FORECAST_DAYS),
    timezone: 'Europe/Madrid',
  })
  return `https://api.open-meteo.com/v1/forecast?${q}`
}

type Daily = {
  time: Day[]
  weather_code: (number | null)[]
  temperature_2m_max: (number | null)[]
  temperature_2m_min: (number | null)[]
  snowfall_sum: (number | null)[]
}

/** One location answers with an object, several with an array, in request order. */
export function parseForecast(json: unknown, resorts: readonly Resort[]): Forecasts {
  const list = (Array.isArray(json) ? json : [json]) as { daily?: Daily }[]
  if (list.length !== resorts.length) throw new Error(`Forecast for ${list.length} places, asked for ${resorts.length}`)
  const out: Forecasts = {}
  resorts.forEach((r, i) => {
    const daily = list[i]?.daily
    if (!daily) throw new Error(`No daily forecast for ${r.name}`)
    const days: Record<Day, DayWeather> = {}
    daily.time.forEach((day, j) => {
      const code = daily.weather_code[j]
      if (code == null) return
      days[day] = {
        day,
        kind: weatherKind(code),
        tMax: Math.round(daily.temperature_2m_max[j] ?? 0),
        tMin: Math.round(daily.temperature_2m_min[j] ?? 0),
        snowCm: Math.round(daily.snowfall_sum[j] ?? 0),
      }
    })
    out[r.id] = days
  })
  return out
}

type KeyValue = Pick<Storage, 'getItem' | 'setItem'>

/** Fetches at most every 30 minutes per browser; a failed fetch keeps the last good forecast. The cache holds only for the same resort ids. */
export async function loadForecasts(
  resorts: readonly Resort[],
  storage: KeyValue,
  fetchFn: typeof fetch = fetch,
  now = Date.now(),
): Promise<Forecasts> {
  const key = 'snow-window:forecast'
  const ids = resorts.map((r) => r.id).sort().join(',')
  const stored = JSON.parse(storage.getItem(key) ?? 'null') as { at: number; ids?: string; data: Forecasts } | null
  // A cache built for another set of resorts would hide the ones added since.
  const cached = stored?.ids === ids ? stored : null
  if (cached && now - cached.at < CACHE_MS) return cached.data
  try {
    const res = await fetchFn(forecastUrl(resorts))
    if (!res.ok) throw new Error(`Forecast request failed (${res.status})`)
    const data = parseForecast(await res.json(), resorts)
    storage.setItem(key, JSON.stringify({ at: now, ids, data }))
    return data
  } catch (e) {
    if (cached) return cached.data
    throw e
  }
}
