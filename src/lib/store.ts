import type { Day } from './dates'
import type { Person } from './overlap'
import { cleanDays, cleanEmoji, cleanName, MAX_PEOPLE } from './rules'

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
