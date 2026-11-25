import type { SupabaseClient } from '@supabase/supabase-js'
import type { Day } from './dates'
import type { Person } from './overlap'
import { BoardFullError, type BoardStore } from './store'
import { type Answer, cleanDraft, type Trip, type TripDraft, type TripStatus } from './trips'

/**
 * The shared board in the Supabase sandbox (schema app_snow_window).
 * Anonymous visitors reach the tables only through these functions; see the migration.
 */
/** Short codes the database raises (migration), in words people understand. */
const ERROR_COPY: Record<string, string> = {
  board_full: "The board is full (20 people).",
  not_your_row: "That row was made on another device. Open its edit link here to change it.",
  day_outside_season: "Pick days inside the season (1 Dec – 30 Apr).",
  trips_full: "There are already 40 suggestions.",
  trip_closed: "That trip was cancelled.",
  not_your_trip: "Only the person who suggested a trip can change it.",
}

function fail(message: string): Error {
  const code = Object.keys(ERROR_COPY).find((c) => message.includes(c))
  return code === "board_full" ? new BoardFullError() : new Error(code ? ERROR_COPY[code] : message)
}

export class SupabaseStore implements BoardStore {
  readonly kind = 'shared'
  constructor(private readonly client: SupabaseClient) {}

  private rpc(fn: string, args?: Record<string, unknown>) {
    return this.client.schema('app_snow_window').rpc(fn, args)
  }

  async load(): Promise<Person[]> {
    const { data, error } = await this.rpc('get_board')
    if (error) throw fail(error.message)
    return data as Person[]
  }

  async addPerson(name: string, emoji: string) {
    const { data, error } = await this.rpc('add_person', { p_name: name, p_emoji: emoji })
    if (error) throw fail(error.message)
    const row = data as { id: string; token: string }
    return { person: { id: row.id, name, emoji, days: [] }, token: row.token }
  }

  async setDays(id: string, token: string, days: Day[]) {
    const { error } = await this.rpc('set_days', { p_id: id, p_token: token, p_days: days })
    if (error) throw fail(error.message)
  }

  async removePerson(id: string, token: string) {
    const { error } = await this.rpc('remove_person', { p_id: id, p_token: token })
    if (error) throw fail(error.message)
  }

  async loadTrips(): Promise<Trip[]> {
    const { data, error } = await this.rpc('get_trips')
    if (error) throw fail(error.message)
    return (data as Trip[]).map((t) => ({ ...t, stayPrice: t.stayPrice === null ? null : Number(t.stayPrice) }))
  }

  async createTrip(personId: string, token: string, draft: TripDraft) {
    const d = cleanDraft(draft)
    const { data, error } = await this.rpc('create_trip', {
      p_person: personId,
      p_token: token,
      p_resort: d.resortId,
      p_start: d.start,
      p_end: d.end,
      p_title: d.title,
      p_note: d.note,
      p_stay_url: d.stayUrl,
      p_stay_price: d.stayPrice,
      p_stay_note: d.stayNote,
    })
    if (error) throw fail(error.message)
    return data as string
  }

  async respond(tripId: string, personId: string, token: string, answer: Answer) {
    const { error } = await this.rpc('respond', { p_trip: tripId, p_person: personId, p_token: token, p_answer: answer })
    if (error) throw fail(error.message)
  }

  async setTripStatus(tripId: string, personId: string, token: string, status: TripStatus) {
    const { error } = await this.rpc('set_trip_status', {
      p_trip: tripId,
      p_person: personId,
      p_token: token,
      p_status: status,
    })
    if (error) throw fail(error.message)
  }
}
