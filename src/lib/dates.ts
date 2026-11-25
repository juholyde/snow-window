/** Calendar days as ISO strings (YYYY-MM-DD), computed in UTC so no time zone shifts a day. */
export type Day = string

const DAY_MS = 86_400_000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function isDay(value: unknown): value is Day {
  return typeof value === 'string' && ISO_DAY.test(value) && toDay(parseDay(value)) === value
}

function parseDay(day: Day): Date {
  return new Date(`${day}T00:00:00Z`)
}

function toDay(date: Date): Day {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: Day, n: number): Day {
  return toDay(new Date(parseDay(day).getTime() + n * DAY_MS))
}

export function daysBetween(from: Day, to: Day): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS)
}

/** Every day from `start` to `end`, both included. */
export function eachDay(start: Day, end: Day): Day[] {
  const n = daysBetween(start, end)
  if (n < 0) throw new Error(`eachDay: ${end} is before ${start}`)
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i))
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: Day): number {
  return parseDay(day).getUTCDay()
}

export function isWeekend(day: Day): boolean {
  const d = weekday(day)
  return d === 0 || d === 6
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts })
const weekdayShort = fmt({ weekday: 'short' })
const dayMonth = fmt({ day: 'numeric', month: 'short' })
const monthYear = fmt({ month: 'long', year: 'numeric' })

export const formatWeekday = (day: Day) => weekdayShort.format(parseDay(day))
export const formatDayMonth = (day: Day) => dayMonth.format(parseDay(day))
export const formatMonth = (day: Day) => monthYear.format(parseDay(day))
export const formatLong = (day: Day) => `${formatWeekday(day)} ${formatDayMonth(day)}`

export function todayLocal(now = new Date()): Day {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
