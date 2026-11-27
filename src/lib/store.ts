import { AREAS, type Area } from '../config/resorts'
import { CITIES } from '../config/cities'
import type { Day } from './dates'
import type { Person } from './overlap'
import { cleanDays, cleanEmoji, cleanName, MAX_CREW_NAME, MAX_PEOPLE } from './rules'
import {
  type Answer,
  type Car,
  cleanBudget,
  cleanCar,
  cleanDraft,
  cleanStay,
  MAX_STAYS,
  MAX_TRIPS,
  nights,
  type StayDraft,
  type Trip,
  type TripDraft,
  type TripStatus,
} from './trips'

/** Who is signed in. A guest is an anonymous account that hasn't been saved with an email yet. */
export type Session = { userId: string; guest: boolean; email: string | null }
export type Crew = { id: string; name: string; ownerId: string | null; inviteCode: string; members: number; regions: Area[] }
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
  /** Leaves for Google: 'save' links Google to this guest (keeps its crews), 'signin' signs in to an account. */
  google(mode: 'save' | 'signin'): Promise<void>
  signOut(): Promise<void>

  profile(): Promise<Person | null>
  saveProfile(name: string, emoji: string): Promise<void>
  setDays(days: Day[]): Promise<void>
  /** A city id from CITIES; null clears it. */
  setHomeCity(city: string | null): Promise<void>

  crews(): Promise<Crew[]>
  createCrew(name: string): Promise<string>
  preview(code: string): Promise<CrewPreview | null>
  joinCrew(code: string): Promise<string>
  renameCrew(crewId: string, name: string): Promise<void>
  resetInvite(crewId: string): Promise<string>
  removeMember(crewId: string, userId: string): Promise<void>
  leaveCrew(crewId: string): Promise<void>
  /** The areas the crew considers, any member. At least one; deduped, in AREAS order. */
  setCrewRegions(crewId: string, regions: Area[]): Promise<void>

  loadCrew(crewId: string): Promise<CrewBoard>
  createTrip(crewId: string, draft: TripDraft): Promise<string>
  respond(tripId: string, answer: Answer): Promise<void>
  setTripStatus(tripId: string, status: TripStatus): Promise<void>

  /** Stays open once a trip is on (any member). */
  setStayPrefs(tripId: string, budget: number | null, driving: boolean | null): Promise<void>
  addStays(tripId: string, stays: StayDraft[]): Promise<void>
  removeStay(stayId: string): Promise<void>
  voteStay(stayId: string, vote: boolean): Promise<void>
  bookStay(tripId: string, stayId: string | null): Promise<void>

  /** Cars open once a trip is on, day trips too (any member). */
  offerCar(tripId: string, seats: number, note: string): Promise<string>
  removeCar(carId: string): Promise<void>
  claimSeat(carId: string): Promise<void>
  leaveSeat(carId: string): Promise<void>
}

/** The database's error codes (migration), in words people understand. */
export const ERROR_COPY: Record<string, string> = {
  not_signed_in: 'You were signed out. Reload to sign in again.',
  guest_limit: 'Too many new guests from this network right now. Try again in an hour, or sign in with your saved account.',
  no_profile: 'Pick a name and an emoji first.',
  not_member: "You're not in that crew.",
  bad_city: "Pick a city from the list.",
  bad_regions: 'Pick at least one area.',
  not_owner: 'Only the person who made the crew can do that.',
  use_leave: 'Use Leave crew to take yourself out.',
  bad_invite: 'That invite link no longer works. Ask for a new one.',
  crew_full: `That crew is full (${MAX_PEOPLE} people).`,
  too_many_crews: "You're in as many crews as you can be.",
  day_outside_season: 'Pick days inside the season (1 Dec – 30 Apr).',
  trips_full: 'This crew already has 40 suggestions.',
  trip_closed: 'That trip was cancelled.',
  not_your_trip: 'Only the person who suggested a trip can change it.',
  trip_not_on: 'Places to stay open once the trip is marked on.',
  day_trip_no_stay: 'A day trip has no place to stay.',
  stays_full: `A trip holds up to ${MAX_STAYS} places to stay. Remove one first.`,
  not_your_stay: 'Only the person who added a place, or who suggested the trip, can remove it.',
  car_exists: 'You already offered a car on this trip. Remove it to offer another.',
  bad_seats: 'A car offers 1 to 8 seats.',
  car_full: 'That car just filled up.',
  own_car: "You're driving on this trip, so you can't take a seat.",
  not_your_car: 'Only the driver, or who suggested the trip, can remove a car.',
  identity_already_exists:
    "That Google account already has a login here. Use Sign in with Google instead (this device's guest crews stay behind).",
  manual_linking_disabled: "Saving with Google isn't switched on yet. Save with your email for now.",
}

export function storeError(message: string): Error {
  const code = Object.keys(ERROR_COPY).find((c) => message.includes(c))
  return new Error(code ? ERROR_COPY[code] : message)
}
const fail = (code: string): never => {
  throw storeError(code)
}

type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type LocalCrew = Omit<Crew, 'members' | 'regions'> & { regions?: Area[]; members: { userId: string; joinedAt: string }[] }
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
  async google(): Promise<void> {
    throw new Error('Google sign-in needs the shared board.')
  }
  async signOut() {
    this.storage.removeItem(`${this.key}:me`)
    this.userId = null
  }

  async profile() {
    const p = this.read().profiles[this.me()]
    return p ? { ...p, homeCity: p.homeCity ?? null } : null
  }
  async saveProfile(name: string, emoji: string) {
    const d = this.read()
    const prev = d.profiles[this.me()]
    d.profiles[this.me()] = { id: this.me(), name: cleanName(name), emoji: cleanEmoji(emoji), days: prev?.days ?? [], homeCity: prev?.homeCity ?? null }
    this.write(d)
  }
  async setDays(days: Day[]) {
    const d = this.read()
    const p = d.profiles[this.me()] ?? fail('no_profile')
    p.days = cleanDays(days)
    this.write(d)
  }
  async setHomeCity(city: string | null) {
    if (city !== null && !CITIES.some((c) => c.id === city)) fail('bad_city')
    const d = this.read()
    const p = d.profiles[this.me()] ?? fail('no_profile')
    p.homeCity = city
    this.write(d)
  }

  async crews(): Promise<Crew[]> {
    return this.read()
      .crews.filter((c) => c.members.some((m) => m.userId === this.me()))
      .map((c) => ({ ...c, members: c.members.length, regions: c.regions ?? ['spain'] }))
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

  async setCrewRegions(crewId: string, regions: Area[]) {
    const d = this.read()
    const crew = this.member(d, crewId)
    const known = AREAS.map((a) => a.id)
    if (!regions.length || regions.some((r) => !known.includes(r))) fail('bad_regions')
    crew.regions = known.filter((a) => regions.includes(a))
    this.write(d)
  }

  async loadCrew(crewId: string): Promise<CrewBoard> {
    const d = this.read()
    const crew = this.member(d, crewId)
    return {
      people: crew.members.flatMap((m) => {
        const p = d.profiles[m.userId]
        return p ? [{ ...p, homeCity: p.homeCity ?? null }] : []
      }),
      trips: d.trips
        .filter((t) => t.crewId === crewId)
        // Trips saved before stays existed lack these fields.
        .map(({ crewId: _, ...t }) => ({
          ...t,
          stayBudget: t.stayBudget ?? null,
          driving: t.driving ?? null,
          bookedStay: t.bookedStay ?? null,
          stays: t.stays ?? [],
          cars: t.cars ?? [],
        }))
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
      stayBudget: null,
      driving: null,
      stays: [],
      bookedStay: null,
      cars: [],
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

  /** The trip a stay change applies to, with the database's rules (require_stay_trip). */
  private stayTrip(d: LocalData, tripId: string): LocalTrip {
    const trip = d.trips.find((t) => t.id === tripId) ?? fail('not_member')
    this.member(d, trip.crewId)
    if (nights(trip) === 0) fail('day_trip_no_stay')
    if (trip.status !== 'on') fail('trip_not_on')
    trip.stays ??= []
    return trip
  }
  private stayOf(d: LocalData, stayId: string) {
    const trip = d.trips.find((t) => t.stays?.some((s) => s.id === stayId)) ?? fail('not_member')
    this.stayTrip(d, trip.id)
    return { trip, stay: trip.stays.find((s) => s.id === stayId) ?? fail('not_member') }
  }
  async setStayPrefs(tripId: string, budget: number | null, driving: boolean | null) {
    const d = this.read()
    const trip = this.stayTrip(d, tripId)
    trip.stayBudget = cleanBudget(budget)
    trip.driving = driving
    this.write(d)
  }
  async addStays(tripId: string, stays: StayDraft[]) {
    const d = this.read()
    const trip = this.stayTrip(d, tripId)
    if (trip.stays.length + stays.length > MAX_STAYS) fail('stays_full')
    for (const s of stays) trip.stays.push({ ...cleanStay(s), id: crypto.randomUUID(), addedBy: this.me(), votes: [] })
    this.write(d)
  }
  async removeStay(stayId: string) {
    const d = this.read()
    const { trip, stay } = this.stayOf(d, stayId)
    if (this.me() !== stay.addedBy && this.me() !== trip.proposerId) fail('not_your_stay')
    trip.stays = trip.stays.filter((s) => s.id !== stayId)
    if (trip.bookedStay === stayId) trip.bookedStay = null
    this.write(d)
  }
  async voteStay(stayId: string, vote: boolean) {
    const d = this.read()
    const { stay } = this.stayOf(d, stayId)
    stay.votes = stay.votes.filter((v) => v !== this.me())
    if (vote) stay.votes.push(this.me())
    this.write(d)
  }
  async bookStay(tripId: string, stayId: string | null) {
    const d = this.read()
    const trip = this.stayTrip(d, tripId)
    if (stayId && !trip.stays.some((s) => s.id === stayId)) fail('not_member')
    trip.bookedStay = stayId
    this.write(d)
  }

  /** The trip a car change applies to, with the database's rules (require_car_trip). */
  private carTrip(d: LocalData, tripId: string): LocalTrip {
    const trip = d.trips.find((t) => t.id === tripId) ?? fail('not_member')
    this.member(d, trip.crewId)
    if (trip.status !== 'on') fail('trip_not_on')
    trip.cars ??= []
    return trip
  }
  private carOf(d: LocalData, carId: string) {
    const trip = d.trips.find((t) => t.cars?.some((c) => c.id === carId)) ?? fail('not_member')
    this.carTrip(d, trip.id)
    return { trip, car: trip.cars.find((c) => c.id === carId) ?? fail('not_member') }
  }
  async offerCar(tripId: string, seats: number, note: string) {
    const d = this.read()
    const trip = this.carTrip(d, tripId)
    const clean = cleanCar(seats, note)
    if (trip.cars.some((c) => c.driverId === this.me())) fail('car_exists')
    for (const c of trip.cars) c.riders = c.riders.filter((r) => r !== this.me())
    const car: Car = { id: crypto.randomUUID(), driverId: this.me(), ...clean, riders: [] }
    trip.cars.push(car)
    this.write(d)
    return car.id
  }
  async removeCar(carId: string) {
    const d = this.read()
    const { trip, car } = this.carOf(d, carId)
    if (this.me() !== car.driverId && this.me() !== trip.proposerId) fail('not_your_car')
    trip.cars = trip.cars.filter((c) => c.id !== carId)
    this.write(d)
  }
  async claimSeat(carId: string) {
    const d = this.read()
    const { trip, car } = this.carOf(d, carId)
    if (trip.cars.some((c) => c.driverId === this.me())) fail('own_car')
    if (car.riders.includes(this.me())) return
    if (car.riders.length >= car.seats) fail('car_full')
    for (const c of trip.cars) c.riders = c.riders.filter((r) => r !== this.me())
    car.riders.push(this.me())
    this.write(d)
  }
  async leaveSeat(carId: string) {
    const d = this.read()
    const { car } = this.carOf(d, carId)
    car.riders = car.riders.filter((r) => r !== this.me())
    this.write(d)
  }
}

/** Takes someone out of a crew with their trips and answers there; passes the crew on or deletes it (as drop_member). */
function drop(d: LocalData, crewId: string, userId: string): LocalData {
  const crew = d.crews.find((c) => c.id === crewId)
  if (!crew) return d
  crew.members = crew.members.filter((m) => m.userId !== userId)
  d.trips = d.trips.filter((t) => !(t.crewId === crewId && t.proposerId === userId))
  for (const t of d.trips) {
    if (t.crewId !== crewId) continue
    delete t.responses[userId]
    for (const s of t.stays ?? []) s.votes = s.votes.filter((v) => v !== userId)
    t.cars = (t.cars ?? []).filter((c) => c.driverId !== userId)
    for (const c of t.cars) c.riders = c.riders.filter((r) => r !== userId)
  }
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
