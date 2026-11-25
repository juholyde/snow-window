import type { Day } from './dates'
import type { Person } from './overlap'
import { cleanDays, cleanEmoji, cleanName, MAX_CREW_NAME, MAX_PEOPLE } from './rules'
import { type Answer, cleanDraft, MAX_TRIPS, type Trip, type TripDraft, type TripStatus } from './trips'

/** Who is signed in. A guest is an anonymous account that hasn't been saved with an email yet. */
export type Session = { userId: string; guest: boolean; email: string | null }
export type Crew = { id: string; name: string; ownerId: string | null; inviteCode: string; members: number }
export type CrewPreview = { id: string; name: string; members: { name: string; emoji: string }[] }
export type CrewBoard = { people: Person[]; trips: Trip[] }

/**
 * Where crews live. Spec: docs/spec/auth-and-crews.md.
 * Every call acts as the signed-in person; `session()` signs in as a guest first if needed.
 */
export interface CrewStore {
  readonly kind: 'shared' | 'local'
  session(): Promise<Session>
  /** Turns a guest into a saved account: Supabase emails a confirmation link. */
  saveAccount(email: string): Promise<void>
  /** Sends a sign-in link to an existing account. */
  signIn(email: string): Promise<void>
  signOut(): Promise<void>

  profile(): Promise<Person | null>
  saveProfile(name: string, emoji: string): Promise<void>
  setDays(days: Day[]): Promise<void>

  crews(): Promise<Crew[]>
  createCrew(name: string): Promise<string>
  preview(code: string): Promise<CrewPreview | null>
  joinCrew(code: string): Promise<string>
  renameCrew(crewId: string, name: string): Promise<void>
  resetInvite(crewId: string): Promise<string>
  removeMember(crewId: string, userId: string): Promise<void>
  leaveCrew(crewId: string): Promise<void>

  loadCrew(crewId: string): Promise<CrewBoard>
  createTrip(crewId: string, draft: TripDraft): Promise<string>
  respond(tripId: string, answer: Answer): Promise<void>
  setTripStatus(tripId: string, status: TripStatus): Promise<void>
}

/** The database's error codes (migration), in words people understand. */
export const ERROR_COPY: Record<string, string> = {
  not_signed_in: 'You are signed out. Reload the page to continue as a guest.',
  no_profile: 'Pick a name and an emoji first.',
  not_member: "You're not in that crew.",
  not_owner: 'Only the person who made the crew can do that.',
  use_leave: 'Use Leave crew to take yourself out.',
  bad_invite: 'That invite link no longer works. Ask for a new one.',
  crew_full: `That crew is full (${MAX_PEOPLE} people).`,
  too_many_crews: "You're in as many crews as you can be.",
  day_outside_season: 'Pick days inside the season (1 Dec – 30 Apr).',
  trips_full: 'This crew already has 40 suggestions.',
  trip_closed: 'That trip was cancelled.',
  not_your_trip: 'Only the person who suggested a trip can change it.',
}

export function storeError(message: string): Error {
  const code = Object.keys(ERROR_COPY).find((c) => message.includes(c))
  return new Error(code ? ERROR_COPY[code] : message)
}
const fail = (code: string): never => {
  throw storeError(code)
}

type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type LocalCrew = Omit<Crew, 'members'> & { members: { userId: string; joinedAt: string }[] }
type LocalTrip = Trip & { crewId: string }
type LocalData = { profiles: Record<string, Person>; crews: LocalCrew[]; trips: LocalTrip[]; emails: Record<string, string> }

/**
 * Crews in this browser only: demo mode, and the fake for tests. Same rules as the database.
 * Stores sharing one storage but given different `userId`s act as different people.
 */
export class LocalStore implements CrewStore {
  readonly kind = 'local'
  constructor(
    private readonly storage: KeyValue,
    private userId: string | null = null,
    private readonly key = 'snow-window:local',
  ) {}

  private read(): LocalData {
    return { profiles: {}, crews: [], trips: [], emails: {}, ...JSON.parse(this.storage.getItem(this.key) ?? '{}') }
  }
  private write(d: LocalData) {
    this.storage.setItem(this.key, JSON.stringify(d))
  }
  private me(): string {
    if (this.userId) return this.userId
    const saved = this.storage.getItem(`${this.key}:me`)
    this.userId = saved ?? crypto.randomUUID()
    if (!saved) this.storage.setItem(`${this.key}:me`, this.userId)
    return this.userId
  }
  private member(d: LocalData, crewId: string): LocalCrew {
    const crew = d.crews.find((c) => c.id === crewId)
    if (!crew?.members.some((m) => m.userId === this.me())) return fail('not_member')
    return crew
  }
  private owned(d: LocalData, crewId: string): LocalCrew {
    const crew = d.crews.find((c) => c.id === crewId)
    if (!crew || crew.ownerId !== this.me()) return fail('not_owner')
    return crew
  }
  private needProfile(d: LocalData) {
    if (!d.profiles[this.me()]) fail('no_profile')
  }

  async session(): Promise<Session> {
    const email = this.read().emails[this.me()] ?? null
    return { userId: this.me(), guest: !email, email }
  }
  async saveAccount(email: string) {
    const d = this.read()
    d.emails[this.me()] = email.trim()
    this.write(d)
  }
  async signIn(email: string) {
    const found = Object.entries(this.read().emails).find(([, e]) => e === email.trim())
    if (!found) throw new Error('No saved account with that email.')
    this.userId = found[0]
    this.storage.setItem(`${this.key}:me`, found[0])
  }
  async signOut() {
    this.storage.removeItem(`${this.key}:me`)
    this.userId = null
  }

  async profile() {
    return this.read().profiles[this.me()] ?? null
  }
  async saveProfile(name: string, emoji: string) {
    const d = this.read()
    const prev = d.profiles[this.me()]
    d.profiles[this.me()] = { id: this.me(), name: cleanName(name), emoji: cleanEmoji(emoji), days: prev?.days ?? [] }
    this.write(d)
  }
  async setDays(days: Day[]) {
    const d = this.read()
    const p = d.profiles[this.me()] ?? fail('no_profile')
    p.days = cleanDays(days)
    this.write(d)
  }

  async crews(): Promise<Crew[]> {
    return this.read()
      .crews.filter((c) => c.members.some((m) => m.userId === this.me()))
      .map((c) => ({ ...c, members: c.members.length }))
  }
  async createCrew(name: string) {
    const d = this.read()
    this.needProfile(d)
    if (d.crews.filter((c) => c.ownerId === this.me()).length >= 10) fail('too_many_crews')
    const crew: LocalCrew = {
      id: crypto.randomUUID(),
      name: cleanCrewName(name),
      ownerId: this.me(),
      inviteCode: crypto.randomUUID(),
      members: [{ userId: this.me(), joinedAt: new Date().toISOString() }],
    }
    d.crews.push(crew)
    this.write(d)
    return crew.id
  }
  async preview(code: string): Promise<CrewPreview | null> {
    const d = this.read()
    const crew = d.crews.find((c) => c.inviteCode === code)
    if (!crew) return null
    const members = crew.members.flatMap((m) => {
      const p = d.profiles[m.userId]
      return p ? [{ name: p.name, emoji: p.emoji }] : []
    })
    return { id: crew.id, name: crew.name, members }
  }
  async joinCrew(code: string) {
    const d = this.read()
    this.needProfile(d)
    const crew = d.crews.find((c) => c.inviteCode === code) ?? fail('bad_invite')
    if (crew.members.some((m) => m.userId === this.me())) return crew.id
    if (crew.members.length >= MAX_PEOPLE) fail('crew_full')
    crew.members.push({ userId: this.me(), joinedAt: new Date().toISOString() })
    this.write(d)
    return crew.id
  }
  async renameCrew(crewId: string, name: string) {
    const d = this.read()
    this.owned(d, crewId).name = cleanCrewName(name)
    this.write(d)
  }
  async resetInvite(crewId: string) {
    const d = this.read()
    const crew = this.owned(d, crewId)
    crew.inviteCode = crypto.randomUUID()
    this.write(d)
    return crew.inviteCode
  }
  async removeMember(crewId: string, userId: string) {
    const d = this.read()
    this.owned(d, crewId)
    if (userId === this.me()) fail('use_leave')
    this.write(drop(d, crewId, userId))
  }
  async leaveCrew(crewId: string) {
    const d = this.read()
    this.member(d, crewId)
    this.write(drop(d, crewId, this.me()))
  }

  async loadCrew(crewId: string): Promise<CrewBoard> {
    const d = this.read()
    const crew = this.member(d, crewId)
    return {
      people: crew.members.flatMap((m) => {
        const p = d.profiles[m.userId]
        return p ? [p] : []
      }),
      trips: d.trips
        .filter((t) => t.crewId === crewId)
        .map(({ crewId: _, ...t }) => t)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }
  }
  async createTrip(crewId: string, draft: TripDraft) {
    const d = this.read()
    this.member(d, crewId)
    if (d.trips.filter((t) => t.crewId === crewId).length >= MAX_TRIPS) fail('trips_full')
    const clean = cleanDraft(draft)
    const trip: LocalTrip = {
      ...clean,
      id: crypto.randomUUID(),
      crewId,
      proposerId: this.me(),
      title: clean.title || null,
      note: clean.note || null,
      stayUrl: clean.stayUrl || null,
      stayNote: clean.stayNote || null,
      status: 'open',
      createdAt: new Date().toISOString(),
      responses: { [this.me()]: 'yes' },
    }
    d.trips.push(trip)
    this.write(d)
    return trip.id
  }
  async respond(tripId: string, answer: Answer) {
    const d = this.read()
    const trip = d.trips.find((t) => t.id === tripId) ?? fail('not_member')
    this.member(d, trip.crewId)
    if (trip.status === 'cancelled') fail('trip_closed')
    trip.responses[this.me()] = answer
    this.write(d)
  }
  async setTripStatus(tripId: string, status: TripStatus) {
    const d = this.read()
    const trip = d.trips.find((t) => t.id === tripId && t.proposerId === this.me()) ?? fail('not_your_trip')
    trip.status = status
    this.write(d)
  }
}

/** Takes someone out of a crew with their trips and answers there; passes the crew on or deletes it (as drop_member). */
function drop(d: LocalData, crewId: string, userId: string): LocalData {
  const crew = d.crews.find((c) => c.id === crewId)
  if (!crew) return d
  crew.members = crew.members.filter((m) => m.userId !== userId)
  d.trips = d.trips.filter((t) => !(t.crewId === crewId && t.proposerId === userId))
  for (const t of d.trips) if (t.crewId === crewId) delete t.responses[userId]
  if (!crew.members.length) d.crews = d.crews.filter((c) => c.id !== crewId)
  else if (crew.ownerId === userId) crew.ownerId = crew.members[0]?.userId ?? null
  return d
}

export function cleanCrewName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (!clean || clean.length > MAX_CREW_NAME) throw new Error(`Give the crew a name of up to ${MAX_CREW_NAME} characters.`)
  return clean
}

/** The invite link for a crew: the app's address with `#join=<code>`. */
export function inviteLink(base: string, code: string): string {
  const url = new URL(base)
  url.hash = `join=${code}`
  return url.toString()
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseInvite(hash: string): string | null {
  const m = /^#join=(.+)$/.exec(hash)
  return m?.[1] && UUID.test(m[1]) ? m[1] : null
}
