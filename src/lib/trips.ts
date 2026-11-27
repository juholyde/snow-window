import { SEASON } from '../config/calendar'
import { RESORTS } from '../config/resorts'
import { type Day, daysBetween, eachDay, formatLong, isDay } from './dates'
import type { Person } from './overlap'

/** Trip suggestions. The database enforces the same limits (…__trips.sql). */
export const MAX_TRIPS = 40
export const MAX_TRIP_DAYS = 14
export const MAX_STAYS = 8

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
  status: TripStatus
  createdAt: string
  responses: Record<string, Answer>
  /** What the crew wants from a place to stay; feeds the AI prompt. Set once the trip is on. */
  stayBudget: number | null
  driving: boolean | null
  stays: Stay[]
  bookedStay: string | null
}

/** A place to stay, suggested once the trip is on (by hand or pasted from an AI answer). */
export type Stay = {
  id: string
  addedBy: string
  name: string
  url: string | null
  /** € per person per night. */
  price: number | null
  why: string | null
  votes: string[]
}
export type StayDraft = Pick<Stay, 'name' | 'url' | 'price' | 'why'>

export type TripDraft = {
  resortId: string
  start: Day
  end: Day
  title: string
  note: string
}

export const nights = (t: { start: Day; end: Day }) => daysBetween(t.start, t.end)

/** Fail fast on anything the database would refuse. */
export function cleanDraft(d: TripDraft): TripDraft {
  if (!RESORTS.some((r) => r.id === d.resortId)) throw new Error('Pick a resort')
  if (!isDay(d.start) || !isDay(d.end)) throw new Error('Pick the dates')
  if (d.start < SEASON.start || d.end > SEASON.end) throw new Error('Pick dates inside the season')
  if (d.end < d.start) throw new Error('The trip ends before it starts')
  if (nights(d) >= MAX_TRIP_DAYS) throw new Error(`A trip is at most ${MAX_TRIP_DAYS} days`)
  if (d.title.trim().length > 60) throw new Error('Title is at most 60 characters')
  if (d.note.trim().length > 500) throw new Error('Note is at most 500 characters')
  return { ...d, title: d.title.trim(), note: d.note.trim() }
}

export function cleanStay(s: StayDraft): StayDraft {
  const name = s.name.trim().replace(/\s+/g, ' ')
  if (!name || name.length > 80) throw new Error('Give the place a name of up to 80 characters')
  const url = s.url?.trim() || null
  if (url && (!/^https:\/\/\S+$/.test(url) || url.length > 500)) throw new Error('The link must start with https://')
  const price = s.price ?? null
  if (price !== null && !(price >= 0 && price < 10_000)) throw new Error('Price per night looks wrong')
  const why = s.why?.trim() || null
  if (why && why.length > 300) throw new Error('The note is at most 300 characters')
  return { name, url, price, why }
}

export function cleanBudget(budget: number | null): number | null {
  if (budget === null) return null
  if (!Number.isInteger(budget) || budget < 0 || budget >= 10_000) throw new Error('Budget per night looks wrong')
  return budget
}

/** The text a crew member copies into Claude (or any chatbot) to get stay options back. */
export function stayPrompt(trip: Trip, people: readonly Person[]): string {
  const resort = RESORTS.find((r) => r.id === trip.resortId)
  const t = tally(trip, people)
  const going = t.yes.length + t.maybe.length || people.length
  const n = nights(trip)
  const on = (d: Day) => `${formatLong(d)} ${d.slice(0, 4)}`
  const lines = [
    `Find places to stay for a ski trip to ${resort?.name ?? trip.resortId} (${resort?.region ?? 'Pyrenees'}).`,
    '',
    `- Dates: check in ${on(trip.start)}, check out ${on(trip.end)} (${n} ${n === 1 ? 'night' : 'nights'}).`,
    `- Group: ${going} ${going === 1 ? 'person' : 'people'}, ideally all in one place.`,
  ]
  if (trip.stayBudget !== null) lines.push(`- Budget: about €${trip.stayBudget} per person per night.`)
  if (trip.driving === true) lines.push('- We drive up: parking matters, a short drive to the lifts is fine.')
  if (trip.driving === false) lines.push('- No car: it must be walkable to the lifts or on a ski bus line.')
  if (trip.note) lines.push(`- Our wishes: ${trip.note}`)
  lines.push(
    '',
    'Suggest 3 real places that can be booked for those dates. For each, link to the page where we can book it.',
    'Answer with only these lines, one per place, keeping the | separators:',
    '',
    'STAY | name | https://link-to-book | price in € per person per night (a number) | why it suits us, one sentence',
  )
  return lines.join('\n')
}

/** Reads `STAY | name | link | price | why` lines out of a pasted AI answer; anything else is ignored. */
export function parseStays(text: string): StayDraft[] {
  const out: StayDraft[] = []
  for (const raw of text.split(/\r?\n/)) {
    // Strip list markers ("- ", "3. ", "> ") and markdown wrappers ("**", "`") around the line.
    const line = raw.replace(/^(?:[\s>*`_-]|\d+[.)])+/, '').replace(/[\s*`_]+$/, '')
    if (!/^stay\s*\|/i.test(line)) continue
    const [, name = '', url = '', price = '', ...why] = line.split('|').map((c) => c.trim())
    const link = /https:\/\/[^\s<>)\]]+/.exec(url)?.[0] ?? null
    const num = Number.parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'))
    out.push(cleanStay({ name, url: link, price: Number.isFinite(num) ? Math.round(num) : null, why: why.join(' | ') || null }))
  }
  if (!out.length) throw new Error('No STAY lines found. Paste the whole answer, with lines that start with STAY |')
  return out.slice(0, MAX_STAYS)
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

/** What a crew member did to a trip's stays; App runs it against the store. */
export type StayAction =
  | { kind: 'prefs'; tripId: string; budget: number | null; driving: boolean | null }
  | { kind: 'add'; tripId: string; stays: StayDraft[] }
  | { kind: 'remove'; stayId: string }
  | { kind: 'vote'; stayId: string; vote: boolean }
  | { kind: 'book'; tripId: string; stayId: string | null }

/** Open or on trips where this person has not answered yet; cancelled ones never wait. */
export function awaitingAnswer(trips: readonly Trip[], personId: string): number {
  return trips.filter((t) => t.status !== 'cancelled' && !t.responses[personId]).length
}
