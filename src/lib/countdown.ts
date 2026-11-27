import { addDays, type Day, daysBetween, formatDayMonth } from './dates'
import type { Trip } from './trips'
import type { DayWeather } from './weather'

/** Snowfall at or above this many cm counts as a powder day. */
export const POWDER_CM = 5

/** The on trip that is running or comes soonest; null when none is still ahead. */
export function nextOnTrip<T extends Pick<Trip, 'status' | 'start' | 'end'>>(trips: readonly T[], today: Day): T | null {
  let best: T | null = null
  for (const t of trips) {
    if (t.status !== 'on' || t.end < today) continue
    if (!best || t.start < best.start) best = t
  }
  return best
}

/** "Today!", "Tomorrow", "In N days" or "On now (day X of Y)"; null once the trip is over. */
export function countdownText(trip: Pick<Trip, 'start' | 'end'>, today: Day): string | null {
  if (trip.end < today) return null
  if (trip.start === today && trip.end === today) return 'Today!'
  if (trip.start <= today) return `On now (day ${daysBetween(trip.start, today) + 1} of ${daysBetween(trip.start, trip.end) + 1})`
  const n = daysBetween(today, trip.start)
  if (n === 1) return 'Tomorrow'
  return `In ${n} days`
}

export type PowderDay = { day: Day; label: string; cm: number; fresh: boolean }

/** Snowfall per trip day (today onwards) that the forecast covers; empty when it covers none. */
export function powderDays(
  trip: Pick<Trip, 'start' | 'end'>,
  forecast: Record<Day, DayWeather> | null,
  today: Day,
): PowderDay[] {
  if (!forecast) return []
  const out: PowderDay[] = []
  for (let d = trip.start < today ? today : trip.start; d <= trip.end; d = addDays(d, 1)) {
    const w = forecast[d]
    if (w) out.push({ day: d, label: formatDayMonth(d), cm: w.snowCm, fresh: w.snowCm >= POWDER_CM })
  }
  return out
}
