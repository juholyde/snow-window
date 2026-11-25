import { HOLIDAYS, KEY_DATES } from '../config/calendar'
import { type Day, eachDay, isWeekend } from './dates'

export type Person = { id: string; name: string; emoji: string; days: Day[] }

/** How many people are free on each day. */
export function countByDay(people: readonly Person[]): Map<Day, number> {
  const counts = new Map<Day, number>()
  for (const p of people) for (const d of p.days) counts.set(d, (counts.get(d) ?? 0) + 1)
  return counts
}

export type TripWindow = {
  start: Day
  end: Day
  length: number
  /** People free on every day of the window. */
  people: number
  weekendDays: number
  holidays: string[]
  keyDates: string[]
}

/**
 * Runs of consecutive days on which at least `minPeople` are free,
 * longest first, then earliest.
 */
export function findWindows(
  season: { start: Day; end: Day },
  counts: Map<Day, number>,
  minPeople: number,
): TripWindow[] {
  if (minPeople < 1) return []
  const windows: TripWindow[] = []
  let run: Day[] = []
  const flush = () => {
    if (run.length) windows.push(describe(run, counts))
    run = []
  }
  for (const day of eachDay(season.start, season.end)) {
    if ((counts.get(day) ?? 0) >= minPeople) run.push(day)
    else flush()
  }
  flush()
  return windows.sort((a, b) => b.length - a.length || a.start.localeCompare(b.start))
}

function describe(run: Day[], counts: Map<Day, number>): TripWindow {
  const start = run[0] as Day
  const end = run[run.length - 1] as Day
  return {
    start,
    end,
    length: run.length,
    people: Math.min(...run.map((d) => counts.get(d) ?? 0)),
    weekendDays: run.filter(isWeekend).length,
    holidays: HOLIDAYS.filter((h) => h.date >= start && h.date <= end).map((h) => h.name),
    keyDates: KEY_DATES.filter((k) => k.start <= end && k.end >= start).map((k) => k.name),
  }
}

export type DayMark = { weekend: boolean; holiday?: string; keyDate?: string }

export function markDay(day: Day): DayMark {
  const holiday = HOLIDAYS.find((h) => h.date === day)
  const key = KEY_DATES.find((k) => day >= k.start && day <= k.end)
  return {
    weekend: isWeekend(day),
    ...(holiday && { holiday: `${holiday.name} (${holiday.scope})` }),
    ...(key && { keyDate: key.name }),
  }
}

/**
 * The best stretches: when everyone who marked days is free if that finds any,
 * otherwise when the most people any day has (at least 2) are free.
 */
export function bestWindows(
  season: { start: Day; end: Day },
  counts: Map<Day, number>,
  marked: number,
  limit = 8,
): { need: number; windows: TripWindow[] } {
  if (marked < 2) return { need: 0, windows: [] }
  const most = Math.max(0, ...counts.values())
  for (let need = marked; need >= Math.max(2, most); need--) {
    const windows = findWindows(season, counts, need)
    if (windows.length) return { need, windows: windows.slice(0, limit) }
  }
  return { need: 0, windows: [] }
}

/** Quick picks for a suggestion: stretches with the most people free first, then fewer (down to 2), never overlapping. */
export function stretchPicks(
  season: { start: Day; end: Day },
  counts: Map<Day, number>,
  marked: number,
  limit = 6,
): TripWindow[] {
  const picks: TripWindow[] = []
  for (let need = marked; need >= 2 && picks.length < limit; need--) {
    for (const w of findWindows(season, counts, need)) {
      if (picks.length >= limit) break
      if (!picks.some((p) => p.start <= w.end && w.start <= p.end)) picks.push(w)
    }
  }
  return picks
}
