import type { Day } from './dates'
import type { Person } from './overlap'
import { cleanDays, cleanEmoji, cleanName, MAX_PEOPLE } from './rules'
import { type Answer, cleanDraft, MAX_TRIPS, type Trip, type TripDraft, type TripStatus } from './trips'

/**
 * Where the board lives. No sign-in: whoever adds a row gets an edit token,
 * kept on their device, which every later change of that row must carry.
 */
export interface BoardStore {
  readonly kind: 'shared' | 'local'
  load(): Promise<Person[]>
  addPerson(name: string, emoji: string): Promise<{ person: Person; token: string }>
  setDays(id: string, token: string, days: Day[]): Promise<void>
  removePerson(id: string, token: string): Promise<void>
  loadTrips(): Promise<Trip[]>
  createTrip(personId: string, token: string, draft: TripDraft): Promise<string>
  respond(tripId: string, personId: string, token: string, answer: Answer): Promise<void>
  setTripStatus(tripId: string, personId: string, token: string, status: TripStatus): Promise<void>
}

export class BoardFullError extends Error {
  constructor() {
    super(`The board is full (${MAX_PEOPLE} people).`)
  }
}

type StoredPerson = Person & { token: string }
type KeyValue = Pick<Storage, 'getItem' | 'setItem'>

/** The board in this browser only: demo mode, and the fake for tests. Same rules as the database. */
export class LocalStore implements BoardStore {
  readonly kind = 'local'
  constructor(
    private readonly storage: KeyValue,
    private readonly key = 'snow-window:local-board',
  ) {}

  private read(): StoredPerson[] {
    return JSON.parse(this.storage.getItem(this.key) ?? '[]') as StoredPerson[]
  }

  private write(rows: StoredPerson[]) {
    this.storage.setItem(this.key, JSON.stringify(rows))
  }

  private owned(rows: StoredPerson[], id: string, token: string): StoredPerson {
    const row = rows.find((r) => r.id === id)
    if (!row || row.token !== token) throw new Error('You can only edit your own row')
    return row
  }

  async load(): Promise<Person[]> {
    return this.read().map(({ token: _, ...p }) => p)
  }

  async addPerson(name: string, emoji: string) {
    const rows = this.read()
    if (rows.length >= MAX_PEOPLE) throw new BoardFullError()
    const person: Person = { id: crypto.randomUUID(), name: cleanName(name), emoji: cleanEmoji(emoji), days: [] }
    const token = crypto.randomUUID()
    this.write([...rows, { ...person, token }])
    return { person, token }
  }

  async setDays(id: string, token: string, days: Day[]) {
    const rows = this.read()
    this.owned(rows, id, token).days = cleanDays(days)
    this.write(rows)
  }

  async removePerson(id: string, token: string) {
    const rows = this.read()
    this.owned(rows, id, token)
    this.write(rows.filter((r) => r.id !== id))
    // Their trips and answers go with the row, as in the database.
    const trips = this.readTrips().filter((t) => t.proposerId !== id)
    for (const t of trips) delete t.responses[id]
    this.writeTrips(trips)
  }

  private readTrips(): Trip[] {
    return JSON.parse(this.storage.getItem(`${this.key}:trips`) ?? '[]') as Trip[]
  }

  private writeTrips(trips: Trip[]) {
    this.storage.setItem(`${this.key}:trips`, JSON.stringify(trips))
  }

  async loadTrips(): Promise<Trip[]> {
    return this.readTrips()
  }

  async createTrip(personId: string, token: string, draft: TripDraft) {
    this.owned(this.read(), personId, token)
    const trips = this.readTrips()
    if (trips.length >= MAX_TRIPS) throw new Error(`There are already ${MAX_TRIPS} suggestions.`)
    const d = cleanDraft(draft)
    const trip: Trip = {
      id: crypto.randomUUID(),
      proposerId: personId,
      resortId: d.resortId,
      start: d.start,
      end: d.end,
      title: d.title || null,
      note: d.note || null,
      stayUrl: d.stayUrl || null,
      stayPrice: d.stayPrice,
      stayNote: d.stayNote || null,
      status: 'open',
      createdAt: new Date().toISOString(),
      responses: { [personId]: 'yes' },
    }
    this.writeTrips([trip, ...trips])
    return trip.id
  }

  async respond(tripId: string, personId: string, token: string, answer: Answer) {
    this.owned(this.read(), personId, token)
    const trips = this.readTrips()
    const trip = trips.find((t) => t.id === tripId && t.status !== 'cancelled')
    if (!trip) throw new Error('That trip is closed.')
    trip.responses[personId] = answer
    this.writeTrips(trips)
  }

  async setTripStatus(tripId: string, personId: string, token: string, status: TripStatus) {
    this.owned(this.read(), personId, token)
    const trips = this.readTrips()
    const trip = trips.find((t) => t.id === tripId && t.proposerId === personId)
    if (!trip) throw new Error('Only the person who suggested a trip can change it.')
    trip.status = status
    this.writeTrips(trips)
  }
}

/** Edit tokens for the rows this device created (or claimed through a link). */
export class TokenKeeper {
  constructor(
    private readonly storage: KeyValue,
    private readonly key = 'snow-window:tokens',
  ) {}

  all(): Record<string, string> {
    return JSON.parse(this.storage.getItem(this.key) ?? '{}') as Record<string, string>
  }

  get(id: string): string | undefined {
    return this.all()[id]
  }

  set(id: string, token: string) {
    this.storage.setItem(this.key, JSON.stringify({ ...this.all(), [id]: token }))
  }

  forget(id: string) {
    const { [id]: _, ...rest } = this.all()
    this.storage.setItem(this.key, JSON.stringify(rest))
  }
}

/** `#claim=<id>.<token>` opens your row for editing on another device. */
export function claimLink(base: string, id: string, token: string): string {
  return `${base.split('#')[0]}#claim=${id}.${token}`
}

export function parseClaim(hash: string): { id: string; token: string } | null {
  const m = /^#claim=([0-9a-f-]{36})\.([0-9a-f-]{36})$/i.exec(hash)
  return m ? { id: m[1] as string, token: m[2] as string } : null
}
