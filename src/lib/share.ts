import { RESORTS } from '../config/resorts'
import { type Day, formatLong } from './dates'
import type { Person } from './overlap'
import { nights, type Trip, tally } from './trips'

const on = (d: Day) => `${formatLong(d)} ${d.slice(0, 4)}`
const names = (ps: readonly Person[]) => ps.map((p) => `${p.emoji} ${p.name}`).join(', ')

/** A short plain-text summary of a trip, ready to paste into WhatsApp. */
export function tripSummary(trip: Trip, people: readonly Person[], crewName: string, crewUrl: string): string {
  const resort = RESORTS.find((r) => r.id === trip.resortId)?.name ?? trip.resortId
  const n = nights(trip)
  const t = tally(trip, people)
  const when = n === 0 ? on(trip.start) : `${on(trip.start)} to ${on(trip.end)} (${n} ${n === 1 ? 'night' : 'nights'})`
  const lines = [`🏂 ${trip.title || resort} is on!`, trip.title ? `${resort}, ${when}` : when]
  lines.push(`Going: ${t.yes.length ? names(t.yes) : 'nobody yet'}`)
  if (t.maybe.length) lines.push(`Maybe: ${names(t.maybe)}`)
  const stay = trip.stays.find((s) => s.id === trip.bookedStay)
  if (stay) lines.push(`Stay: ${stay.name}${stay.url ? ` ${stay.url}` : ''}`)
  lines.push(`Board for ${crewName}: ${crewUrl}`)
  return lines.join('\n')
}

/** A one-line invite to send with the crew link. */
export function inviteMessage(crewName: string, crewUrl: string): string {
  return `⛷️ Join ${crewName} on Snow Window: add the days you can ski and we'll find the dates that work.\n${crewUrl}`
}
