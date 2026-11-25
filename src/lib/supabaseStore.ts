import type { SupabaseClient } from '@supabase/supabase-js'
import type { Day } from './dates'
import type { Person } from './overlap'
import { cleanDays, cleanEmoji, cleanName } from './rules'
import { type Crew, type CrewBoard, type CrewPreview, type CrewStore, cleanCrewName, ERROR_COPY, type Session, storeError } from './store'
import { type Answer, cleanDraft, type TripDraft, type TripStatus } from './trips'

const APP = 'snow_window'

/** The sandbox's per-app roles in the access token (custom access token hook). */
function appsClaim(token: string): Record<string, string> {
  const part = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
  try {
    return (JSON.parse(atob(part)) as { apps?: Record<string, string> }).apps ?? {}
  } catch {
    return {}
  }
}

/**
 * Crews in the Supabase sandbox (schema app_snow_window). Spec: docs/spec/auth-and-crews.md.
 * The first visit signs in anonymously; the sandbox adds the app membership from `data.app`.
 */
export class SupabaseStore implements CrewStore {
  readonly kind = 'shared'
  constructor(
    private readonly client: SupabaseClient,
    /** Where email links land: this page, without its hash. */
    private readonly redirectTo: string,
  ) {}

  private async call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.schema('app_snow_window').rpc(fn, args)
    if (error) throw storeError(error.message)
    return data as T
  }

  async session(): Promise<Session> {
    let { data } = await this.client.auth.getSession()
    if (!data.session) {
      const res = await this.client.auth.signInAnonymously({ options: { data: { app: APP } } })
      if (res.error) throw storeError(res.error.message)
      data = { session: res.data.session }
    }
    let session = data.session
    // A saved account signing in for the first time may not be in the app yet.
    if (session && !appsClaim(session.access_token)[APP]) {
      const join = await this.client.schema('platform').rpc('join_app', { slug: APP })
      if (join.error) throw storeError(join.error.message)
      const refreshed = await this.client.auth.refreshSession()
      if (refreshed.error) throw storeError(refreshed.error.message)
      session = refreshed.data.session
    }
    if (!session) throw storeError('not_signed_in')
    const user = session.user
    return { userId: user.id, guest: Boolean(user.is_anonymous), email: user.email ?? null }
  }

  async saveAccount(email: string) {
    const { error } = await this.client.auth.updateUser({ email: email.trim() }, { emailRedirectTo: this.redirectTo })
    if (error) throw storeError(error.message)
  }
  async signIn(email: string) {
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: this.redirectTo },
    })
    if (error) throw storeError(error.message)
  }
  async google(mode: 'save' | 'signin') {
    const options = { redirectTo: this.redirectTo }
    const { error } =
      mode === 'save'
        ? await this.client.auth.linkIdentity({ provider: 'google', options })
        : await this.client.auth.signInWithOAuth({ provider: 'google', options })
    if (error) throw storeError(error.code && error.code in ERROR_COPY ? error.code : error.message)
  }
  async signOut() {
    const { error } = await this.client.auth.signOut()
    if (error) throw storeError(error.message)
  }

  profile = () => this.call<Person | null>('get_profile')
  saveProfile = (name: string, emoji: string) =>
    this.call<void>('save_profile', { p_name: cleanName(name), p_emoji: cleanEmoji(emoji) })
  setDays = (days: Day[]) => this.call<void>('set_days', { p_days: cleanDays(days) })

  crews = () => this.call<Crew[]>('my_crews')
  createCrew = (name: string) => this.call<string>('create_crew', { p_name: cleanCrewName(name) })
  preview = (code: string) => this.call<CrewPreview | null>('crew_preview', { p_code: code })
  joinCrew = (code: string) => this.call<string>('join_crew', { p_code: code })
  renameCrew = (crewId: string, name: string) =>
    this.call<void>('rename_crew', { p_crew: crewId, p_name: cleanCrewName(name) })
  resetInvite = (crewId: string) => this.call<string>('reset_invite', { p_crew: crewId })
  removeMember = (crewId: string, userId: string) => this.call<void>('remove_member', { p_crew: crewId, p_user: userId })
  leaveCrew = (crewId: string) => this.call<void>('leave_crew', { p_crew: crewId })

  loadCrew = (crewId: string) => this.call<CrewBoard>('get_crew', { p_crew: crewId })
  createTrip(crewId: string, draft: TripDraft) {
    const d = cleanDraft(draft)
    return this.call<string>('create_trip', {
      p_crew: crewId,
      p_resort: d.resortId,
      p_start: d.start,
      p_end: d.end,
      p_title: d.title,
      p_note: d.note,
      p_stay_url: d.stayUrl,
      p_stay_price: d.stayPrice,
      p_stay_note: d.stayNote,
    })
  }
  respond = (tripId: string, answer: Answer) => this.call<void>('respond', { p_trip: tripId, p_answer: answer })
  setTripStatus = (tripId: string, status: TripStatus) =>
    this.call<void>('set_trip_status', { p_trip: tripId, p_status: status })
}
