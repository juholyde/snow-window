import { SEASON } from '../config/calendar'
import { RESORTS } from '../config/resorts'
import { type Day, daysBetween, eachDay, isDay } from './dates'
import type { Person } from './overlap'

/** Trip suggestions. The database enforces the same limits (…__trips.sql). */
export const MAX_TRIPS = 40
export const MAX_TRIP_DAYS = 14

export type Answer = 'yes' | 'maybe' | 'no'
export type TripStatus = 'open' | 'on' | 'cancelled'

export type Trip = {
  id: string
  proposerId: string
  resortId: string
  start: Day
  end: Day
  title: string | null
  note: string | null
  stayUrl: string | null
  stayPrice: number | null
  stayNote: string | null
  status: TripStatus
  createdAt: string
  responses: Record<string, Answer>
}

export type TripDraft = {
  resortId: string
  start: Day
  end: Day
  title: string
  note: string
  stayUrl: string
  stayPrice: number | null
  stayNote: string
}

export const nights = (t: { start: Day; end: Day }) => daysBetween(t.start, t.end)

/** Fail fast on anything the database would refuse; a day trip loses its stay. */
export function cleanDraft(d: TripDraft): TripDraft {
  if (!RESORTS.some((r) => r.id === d.resortId)) throw new Error('Pick a resort')
  if (!isDay(d.start) || !isDay(d.end)) throw new Error('Pick the dates')
  if (d.start < SEASON.start || d.end > SEASON.end) throw new Error('Pick dates inside the season')
  if (d.end < d.start) throw new Error('The trip ends before it starts')
  if (nights(d) >= MAX_TRIP_DAYS) throw new Error(`A trip is at most ${MAX_TRIP_DAYS} days`)
  if (d.title.trim().length > 60) throw new Error('Title is at most 60 characters')
  if (d.note.trim().length > 500) throw new Error('Note is at most 500 characters')
  const dayTrip = d.start === d.end
  const stayUrl = dayTrip ? '' : d.stayUrl.trim()
  if (stayUrl && !/^https:\/\/\S+$/.test(stayUrl)) throw new Error('The stay link must start with https://')
  const stayPrice = dayTrip ? null : d.stayPrice
  if (stayPrice !== null && !(stayPrice >= 0 && stayPrice < 10_000)) throw new Error('Price per night looks wrong')
  const stayNote = dayTrip ? '' : d.stayNote.trim()
  if (stayNote.length > 300) throw new Error('Stay note is at most 300 characters')
  return { ...d, title: d.title.trim(), note: d.note.trim(), stayUrl, stayPrice, stayNote }
}

/** Who is free on every day of the trip, and who would miss part or all of it. */
export function coverage(t: { start: Day; end: Day }, people: readonly Person[]) {
  const days = eachDay(t.start, t.end)
  const free: Person[] = []
  const miss: Person[] = []
  for (const p of people) {
    if (!p.days.length) continue
    const set = new Set(p.days)
    ;(days.every((d) => set.has(d)) ? free : miss).push(p)
  }
  return { free, miss }
}

export type Tally = Record<Answer | 'none', Person[]>

export function tally(t: Trip, people: readonly Person[]): Tally {
  const out: Tally = { yes: [], maybe: [], no: [], none: [] }
  for (const p of people) out[t.responses[p.id] ?? 'none'].push(p)
  return out
}

/** On first, then open, then cancelled; newest first within each. */
export function sortTrips(trips: readonly Trip[]): Trip[] {
  const rank: Record<TripStatus, number> = { on: 0, open: 1, cancelled: 2 }
  return [...trips].sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.localeCompare(a.createdAt))
}

export type DatePick = { start: Day; end: Day; people: number }

/**
 * Quick picks for the composer: single days with the most people free (day trips),
 * or stretches of 2+ days, trimmed to the trip limit (multi-day). Best first.
 */
export function datePicks(kind: 'day' | 'multi', counts: Map<Day, number>, limit = 8): DatePick[] {
  const days = eachDay(SEASON.start, SEASON.end)
  if (kind === 'day') {
    return days
      .filter((d) => (counts.get(d) ?? 0) >= 2)
      .map((d) => ({ start: d, end: d, people: counts.get(d) ?? 0 }))
      .sort((a, b) => b.people - a.people || a.start.localeCompare(b.start))
      .slice(0, limit)
  }
  const picks: DatePick[] = []
  const most = Math.max(0, ...counts.values())
  for (let need = most; need >= 2 && picks.length < limit; need--) {
    let run: Day[] = []
    const flush = () => {
      const start = run[0]
      if (run.length >= 2 && start && !picks.some((p) => p.start <= start && p.end >= start)) {
        const end = run[Math.min(run.length, MAX_TRIP_DAYS) - 1] as Day
        picks.push({ start, end, people: need })
      }
      run = []
    }
    for (const d of days) {
      if ((counts.get(d) ?? 0) >= need) run.push(d)
      else flush()
    }
    flush()
  }
  return picks.slice(0, limit)
}
