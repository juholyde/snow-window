import { RESORTS } from '../config/resorts'
import { addDays } from './dates'
import type { Person } from './overlap'
import { tripSummary } from './share'
import type { Trip } from './trips'

/** RFC 5545 TEXT escaping: backslash first, then , ; and newlines. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\r?\n/g, '\\n')

/** Fold a content line to at most 75 octets, never splitting a UTF-8 character. */
export function fold(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const w = enc.encode(ch).length
    if (size + w > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += w
  }
  out.push(cur)
  return out.join('\r\n ')
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
const compact = (day: string) => day.replace(/-/g, '')

/**
 * An all-day calendar event for a trip. The event covers start..end inclusive
 * (the checkout day counts as a ski day), so DTEND, which is exclusive, is end + 1.
 */
export function tripIcs(trip: Trip, people: readonly Person[], crewName: string, crewUrl: string, now = new Date()): string {
  const resort = RESORTS.find((r) => r.id === trip.resortId)?.name ?? trip.resortId
  const stay = trip.stays.find((s) => s.id === trip.bookedStay)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Snow Window//Trip//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${trip.id}@snow-window`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${compact(trip.start)}`,
    `DTEND;VALUE=DATE:${compact(addDays(trip.end, 1))}`,
    `SUMMARY:${esc(`🏂 ${trip.title || resort}`)}`,
    `LOCATION:${esc(resort)}`,
    `DESCRIPTION:${esc(tripSummary(trip, people, crewName, crewUrl))}`,
    ...(stay?.url ? [`URL:${stay.url}`] : []),
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}

export const icsFilename = (trip: Trip) => `snow-window-${trip.resortId}-${trip.start}.ics`

/** Hand the file to the browser as a download. */
export function downloadIcs(trip: Trip, ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = icsFilename(trip)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
