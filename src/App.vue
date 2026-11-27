<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import AccountDialog from './components/AccountDialog.vue'
import AppIcon from './components/AppIcon.vue'
import AvailabilityTimeline from './components/AvailabilityTimeline.vue'
import BestWindows from './components/BestWindows.vue'
import CrewSheet from './components/CrewSheet.vue'
import TripCountdown from './components/TripCountdown.vue'
import ResortsTab from './components/ResortsTab.vue'
import TripsTab, { type TripsView } from './components/TripsTab.vue'
import WelcomeCard from './components/WelcomeCard.vue'
import { HOLIDAYS, KEY_DATES, SEASON } from './config/calendar'
import { RESORTS } from './config/resorts'
import { type Day, eachDay, formatDayMonth, formatLong, todayLocal } from './lib/dates'
import { bestWindows, countByDay, markDay, type Person, type TripWindow } from './lib/overlap'
import { type StepKind, nextStep } from './lib/nextStep'
import { MAX_PEOPLE } from './lib/rules'
import { inviteMessage } from './lib/share'
import { type Range, span } from './lib/selection'
import { type Crew, type CrewPreview, type CrewStore, inviteLink, parseInvite, type Session, storeError } from './lib/store'
import { type Answer, awaitingAnswer, MAX_TRIP_DAYS, type StayAction, type Trip, type TripDraft, type TripStatus } from './lib/trips'
import { type Forecasts, loadForecasts } from './lib/weather'

const props = defineProps<{ store: CrewStore; authError?: string | null }>()

const CREW_KEY = 'snow-window:crew'
const art = import.meta.env.BASE_URL + 'art/'
const days = eachDay(SEASON.start, SEASON.end)

const session = ref<Session | null>(null)
const profile = shallowRef<Person | null>(null)
const crews = shallowRef<Crew[]>([])
const crewId = ref<string | null>(null)
const invite = ref<string | null>(null)
const preview = shallowRef<CrewPreview | null>(null)
const badInvite = ref(false)
const creating = ref(false)
const accountOpen = ref(false)
const crewOpen = ref(false)
const startError = ref<string | null>(null)

const people = shallowRef<Person[]>([])
const trips = shallowRef<Trip[]>([])
const loaded = ref(false)
const busy = ref(false)
const toast = ref<{ text: string; error?: boolean } | null>(null)
/** Messages for the always-mounted live region; screen readers miss text that arrives with its own element. */
const announced = ref<string[]>([])
/** The trip just suggested: its card is highlighted for a moment. */
const freshTrip = ref<string | null>(null)
const focused = ref<Day | null>(null)
const highlight = ref<{ start: Day; end: Day } | null>(null)
const forecasts = shallowRef<Forecasts | null>(null)
const forecastError = ref(false)
const resortId = ref(localStorage.getItem('snow-window:resort') ?? RESORTS[0]?.id ?? '')
function pickResort(id: string) {
  resortId.value = id
  localStorage.setItem('snow-window:resort', id)
}
async function refreshForecast() {
  try {
    forecasts.value = await loadForecasts(RESORTS, localStorage)
    forecastError.value = false
  } catch {
    forecastError.value = true
  }
}
const timeline = ref<InstanceType<typeof AvailabilityTimeline> | null>(null)

const crew = computed(() => crews.value.find((c) => c.id === crewId.value) ?? null)
/** The welcome card shows with no crew, while an invite waits, or while starting another crew. */
const welcome = computed(() => Boolean(session.value) && (!crew.value || Boolean(preview.value) || creating.value))
const me = computed(() => session.value?.userId ?? '')
const editable = computed(() => new Set(profile.value ? [me.value] : []))
const mine = computed(() => people.value.filter((p) => p.id === me.value))
const counts = computed(() => countByDay(people.value))
const marked = computed(() => people.value.filter((p) => p.days.length).length)

let toastTimer: ReturnType<typeof setTimeout> | undefined
let announceTimer: ReturnType<typeof setTimeout> | undefined
function announce(text: string) {
  announced.value = [...announced.value, text]
  clearTimeout(announceTimer)
  announceTimer = setTimeout(() => (announced.value = []), 8000)
}
function say(text: string, error = false) {
  announce(text)
  toast.value = { text, error }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), error ? 6000 : 3500)
}

/** Moves focus once the DOM has updated; falls back to the Trips view switch when the target is gone. */
async function focusAt(selector: string) {
  await nextTick()
  const el = document.querySelector<HTMLElement>(selector) ?? document.querySelector<HTMLElement>('.trips-bar [aria-selected=true]')
  el?.focus({ preventScroll: true })
  return el
}

/** Runs one store call with the busy flag and turns failures into a toast. */
async function act<T>(run: () => Promise<T>, ok?: string): Promise<{ value: T } | null> {
  busy.value = true
  try {
    const value = await run()
    if (ok) say(ok)
    return { value }
  } catch (e) {
    say((e as Error).message, true)
    return null
  } finally {
    busy.value = false
  }
}

function selectCrew(id: string | null) {
  crewId.value = id
  if (id) localStorage.setItem(CREW_KEY, id)
  else localStorage.removeItem(CREW_KEY)
  people.value = []
  trips.value = []
  loaded.value = false
  tripsPicked.value = null
  tripRange.value = null
  if (id) refresh()
}

async function loadMine() {
  ;[profile.value, crews.value] = await Promise.all([props.store.profile(), props.store.crews()])
  const saved = localStorage.getItem(CREW_KEY)
  const pick = crews.value.find((c) => c.id === crewId.value) ?? crews.value.find((c) => c.id === saved) ?? crews.value[0]
  if (pick?.id !== crewId.value) selectCrew(pick?.id ?? null)
}

let lastLoadError = ''
async function refresh() {
  const id = crewId.value
  if (!id) return
  try {
    const board = await props.store.loadCrew(id)
    if (id !== crewId.value) return
    people.value = board.people
    trips.value = board.trips
    const first = !loaded.value
    loaded.value = true
    lastLoadError = ''
    if (first) {
      await nextTick()
      const begin = todayLocal() > SEASON.start && todayLocal() <= SEASON.end ? todayLocal() : SEASON.start
      timeline.value?.scrollToDay(begin, false)
    }
  } catch (e) {
    // The poll retries every 30s: say each distinct failure once.
    const message = (e as Error).message
    if (message !== lastLoadError) say(`Couldn't load the crew: ${message}`, true)
    lastLoadError = message
  }
}

async function start() {
  startError.value = null
  try {
    session.value = await props.store.session()
    await loadMine()
  } catch (e) {
    startError.value = (e as Error).message
    return
  }
  const code = parseInvite(location.hash)
  if (code) {
    history.replaceState(null, '', location.pathname + location.search)
    await openInvite(code)
  }
}

async function openInvite(code: string) {
  const res = await act(() => props.store.preview(code))
  if (!res) return
  const found = res.value
  const already = found && crews.value.find((c) => c.id === found.id)
  if (already) {
    selectCrew(already.id)
    say(`You're already in ${already.name}.`)
  } else if (found) {
    invite.value = code
    preview.value = found
  } else badInvite.value = true
}

async function saveProfileIfNeeded(name: string, emoji: string) {
  if (!profile.value) await props.store.saveProfile(name, emoji)
}

async function createCrew(name: string, emoji: string, crewName: string) {
  const res = await act(async () => {
    await saveProfileIfNeeded(name, emoji)
    return props.store.createCrew(crewName)
  })
  if (!res) return
  const id = res.value
  creating.value = false
  badInvite.value = false
  await loadMine()
  selectCrew(id)
  say('Crew made. Copy the invite link and send it to your friends.')
}

async function joinCrew(name: string, emoji: string) {
  const code = invite.value
  if (!code) return
  const res = await act(async () => {
    await saveProfileIfNeeded(name, emoji)
    return props.store.joinCrew(code)
  })
  if (!res) return
  const id = res.value
  const joined = preview.value?.name
  cancelWelcome()
  await loadMine()
  selectCrew(id)
  say(`You're in ${joined}. Tap or drag across your row to mark the days you can go.`)
}

function cancelWelcome() {
  creating.value = false
  preview.value = null
  invite.value = null
  badInvite.value = false
}

async function change(id: string, next: Day[]) {
  if (id !== me.value) return
  const before = people.value
  people.value = before.map((p) => (p.id === id ? { ...p, days: next } : p))
  try {
    await props.store.setDays(next)
  } catch (e) {
    people.value = before
    say(`Not saved: ${(e as Error).message}`, true)
  }
}

const crewUrl = computed(() => (crew.value ? inviteLink(location.origin + location.pathname, crew.value.inviteCode) : ''))

async function copyInvite() {
  if (!crew.value) return
  const link = crewUrl.value
  try {
    await navigator.clipboard.writeText(inviteMessage(crew.value.name, link))
    say('Invite message copied. Anyone who opens it can join the crew.')
  } catch {
    window.prompt('Copy this invite message:', inviteMessage(crew.value.name, link))
  }
}

async function renameCrew(name: string) {
  const id = crewId.value
  if (id && await act(() => props.store.renameCrew(id, name), 'Renamed.')) await loadMine()
}

async function resetInvite() {
  const id = crewId.value
  if (!id || !window.confirm('Make a new invite link? The old link stops working.')) return
  if (await act(() => props.store.resetInvite(id), 'New link made. The old one no longer works.')) await loadMine()
}

async function removeMember(p: Person) {
  const id = crewId.value
  if (!id || !window.confirm(`Remove ${p.name} from the crew? Their suggestions and answers here go too.`)) return
  if (await act(() => props.store.removeMember(id, p.id), `${p.name} is out of the crew.`)) await refresh()
}

async function leaveCrew() {
  const c = crew.value
  if (!c || !window.confirm(`Leave ${c.name}? Your suggestions and answers there go too.`)) return
  if (!(await act(() => props.store.leaveCrew(c.id), `You left ${c.name}.`))) return
  crewOpen.value = false
  selectCrew(null)
  await loadMine()
}

async function saveProfile(name: string, emoji: string) {
  if (!(await act(() => props.store.saveProfile(name, emoji), 'Saved.'))) return
  profile.value = await props.store.profile()
  await refresh()
}

async function saveAccount(email: string) {
  const done = await act(
    () => props.store.saveAccount(email),
    props.store.kind === 'shared' ? 'Check your email and open the link to finish saving.' : 'Saved.',
  )
  if (!done) return
  session.value = await props.store.session()
  accountOpen.value = false
}

async function signIn(email: string) {
  if (!(await act(() => props.store.signIn(email)))) return
  accountOpen.value = false
  if (props.store.kind === 'shared') say('Check your email for the sign-in link.')
  else await start()
}

async function google(mode: 'save' | 'signin') {
  // Success leaves the page for Google; only a failure comes back here.
  await act(() => props.store.google(mode))
}

async function signOut() {
  if (!(await act(() => props.store.signOut()))) return
  accountOpen.value = false
  localStorage.removeItem(CREW_KEY)
  crewId.value = null
  people.value = []
  trips.value = []
  await start()
}

function pickCrew(id: string) {
  crewOpen.value = false
  if (id !== crewId.value) selectCrew(id)
}
function newCrew() {
  crewOpen.value = false
  creating.value = true
}
function openAccount() {
  crewOpen.value = false
  accountOpen.value = true
}

type Tab = 'board' | 'windows' | 'trips' | 'resorts'
const TABS: { id: Tab; label: string; short: string; icon: 'board' | 'calendar' | 'mountain' | 'snow' }[] = [
  { id: 'board', label: 'Board', short: 'Board', icon: 'board' },
  { id: 'windows', label: 'Snow windows', short: 'Windows', icon: 'calendar' },
  { id: 'trips', label: 'Trips', short: 'Trips', icon: 'snow' },
  { id: 'resorts', label: 'Resorts', short: 'Resorts', icon: 'mountain' },
]
const tab = ref<Tab>('board')

/** Jump to a day on the board, from any tab. */
async function showOnBoard(day: Day, range?: { start: Day; end: Day }) {
  tab.value = 'board'
  highlight.value = range ?? null
  focused.value = day
  await nextTick()
  timeline.value?.scrollToDay(day)
}

function pickWindow(w: TripWindow) {
  showOnBoard(w.start, { start: w.start, end: w.end })
}

const openTrips = computed(() => trips.value.filter((t) => t.status !== 'cancelled').length)
// Trips opens on Answer when there is something to answer, otherwise on Suggest.
const waiting = computed(() => awaitingAnswer(trips.value, me.value))
const tripsPicked = ref<TripsView | null>(null)
const tripsView = computed<TripsView>(() => tripsPicked.value ?? (openTrips.value ? 'answer' : 'suggest'))
const tripRange = ref<Range | null>(null)

function answerTrips() {
  tripsPicked.value = 'answer'
  tab.value = 'trips'
}

const step = computed(() => {
  const state = {
    people: people.value.length,
    marked: marked.value,
    iMarked: mine.value.some((p) => p.days.length > 0),
    waiting: waiting.value,
    hasWindow: bestWindows(SEASON, counts.value, marked.value).windows.length > 0,
    trips: trips.value,
  }
  return nextStep(state)
})

watch(
  () => step.value?.text,
  (text) => text && announce(text),
)

function runStep(kind: StepKind) {
  if (kind === 'answer') answerTrips()
  else if (kind === 'nudge') copyInvite()
  else if (kind === 'windows') tab.value = 'windows'
  else if (kind === 'suggest') {
    tripsPicked.value = 'suggest'
    tab.value = 'trips'
  }
}

function suggestFrom(w: TripWindow) {
  tripRange.value = span(w.start, w.end, MAX_TRIP_DAYS)
  tripsPicked.value = 'suggest'
  tab.value = 'trips'
}

async function tripAction<T>(run: () => Promise<T>, ok?: string) {
  const res = await act(run, ok)
  if (res) await refresh()
  return res
}

const tripSel = (id: string) => `[data-trip="${id}"]`
let freshTimer: ReturnType<typeof setTimeout> | undefined
async function showNewTrip(id: string) {
  freshTrip.value = id
  clearTimeout(freshTimer)
  freshTimer = setTimeout(() => (freshTrip.value = null), 2500)
  const heading = await focusAt(`${tripSel(id)} h3`)
  const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  heading?.scrollIntoView?.({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
}

async function createTrip(_personId: string, draft: TripDraft) {
  const id = crewId.value
  if (!id) return
  const res = await tripAction(() => props.store.createTrip(id, draft), 'Suggested. The crew can answer now.')
  if (!res) return
  tripRange.value = null
  tripsPicked.value = 'answer'
  await showNewTrip(res.value)
}
const respond = (tripId: string, _personId: string, answer: Answer) => tripAction(() => props.store.respond(tripId, answer))
async function setStatus(tripId: string, _personId: string, status: TripStatus) {
  const res = await tripAction(() => props.store.setTripStatus(tripId, status), status === 'on' ? "It's on! Everyone can see it." : undefined)
  // The button that was pressed is replaced (or the card is gone): land on the card heading.
  if (res) await focusAt(`${tripSel(tripId)} h3`)
}

async function stayDone(a: StayAction, res: unknown) {
  if (!res) return
  if (a.kind === 'add') await focusAt(`#stay-${a.tripId}`)
  else if (a.kind === 'book') await focusAt(a.stayId ? `${tripSel(a.tripId)} li.booked [data-book]` : `#stay-${a.tripId}`)
}

async function stayAction(a: StayAction) {
  await stayDone(a, await runStay(a))
}
function runStay(a: StayAction) {
  const s = props.store
  switch (a.kind) {
    case 'prefs':
      return tripAction(() => s.setStayPrefs(a.tripId, a.budget, a.driving))
    case 'add':
      return tripAction(() => s.addStays(a.tripId, a.stays), a.stays.length === 1 ? 'Place added.' : `${a.stays.length} places added.`)
    case 'remove':
      return tripAction(() => s.removeStay(a.stayId))
    case 'vote':
      return tripAction(() => s.voteStay(a.stayId, a.vote))
    case 'book':
      return tripAction(() => s.bookStay(a.tripId, a.stayId), a.stayId ? 'Marked as booked.' : undefined)
  }
}

function useResort(id: string) {
  pickResort(id)
  tab.value = 'board'
}

async function onTabKey(e: KeyboardEvent) {
  const i = TABS.findIndex((t) => t.id === tab.value)
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  const next = TABS[(i + step + TABS.length) % TABS.length]
  if (!next) return
  tab.value = next.id
  await nextTick()
  document.getElementById(`tab-${next.id}`)?.focus()
}

const focusInfo = computed(() => {
  const d = focused.value
  if (!d) return null
  const free = people.value.filter((p) => p.days.includes(d))
  const weather = RESORTS.flatMap((r) => {
    const w = forecasts.value?.[r.id]?.[d]
    return w ? [{ resort: r, w }] : []
  }).sort((a, b) => b.w.snowCm - a.w.snowCm)
  return { day: d, mark: markDay(d), free, weather }
})

// The day strip is plain text; its summary goes through the always-mounted status region.
watch(focusInfo, (f, old) => {
  if (f && f.day !== old?.day) announce(`${formatLong(f.day)}: ${f.free.length} of ${people.value.length} free`)
})

// Someone else's edits show up within half a minute, and at once when you come back to the tab.
let poll: ReturnType<typeof setInterval> | undefined
let weatherPoll: ReturnType<typeof setInterval> | undefined
const onVisible = () => {
  if (document.visibilityState !== 'visible') return
  refresh()
  refreshForecast()
}
const onHash = () => {
  const code = parseInvite(location.hash)
  if (!code || !session.value) return
  history.replaceState(null, '', location.pathname + location.search)
  openInvite(code)
}

onMounted(async () => {
  refreshForecast()
  weatherPoll = setInterval(refreshForecast, 30 * 60_000)
  await start()
  if (props.authError) say(storeError(props.authError).message, true)
  poll = setInterval(refresh, 30_000)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('hashchange', onHash)
})
onBeforeUnmount(() => {
  clearInterval(poll)
  clearInterval(weatherPoll)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('hashchange', onHash)
})
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="masthead">
        <picture class="mountain-print">
          <source media="(max-width: 512px)" :srcset="art + 'spanish-mountains@512.png'" />
          <img :src="art + 'spanish-mountains.png'" alt="" />
        </picture>
        <img class="masthead-sun" :src="art + 'sun@512.png'" alt="" width="512" height="512" />
        <div class="brand">
          <h1><img :src="art + 'logo-wordmark@512.png'" :srcset="art + 'logo-wordmark@512.png 512w, ' + art + 'logo-wordmark.png 2048w'" sizes="(max-width: 760px) 230px, 350px" alt="Snow Window" /></h1>
          <p class="tagline">December 2026 – April 2027</p>
        </div>
        <div v-if="session && profile" class="account-bar">
          <button v-if="crew && !welcome" type="button" class="crew-button" aria-haspopup="dialog" @click="crewOpen = true">
            <span class="crew-faces" aria-hidden="true">
              <span v-for="p in people.slice(0, 3)" :key="p.id">{{ p.emoji }}</span>
            </span>
            <span class="crew-button-name">{{ crew.name }}</span>
            <small class="crew-button-count">{{ people.length || crew.members }}</small>
          </button>
          <button type="button" class="me-button" :aria-label="`Your profile: ${profile.name}`" @click="accountOpen = true">
            <span class="avatar">{{ profile.emoji }}</span>
            <span v-if="session.guest" class="me-guest">Guest</span>
          </button>
        </div>
      </div>
      <div v-if="crew && !welcome" class="tabs" role="tablist" aria-label="Views" @keydown="onTabKey">
        <button
          v-for="t in TABS"
          :id="`tab-${t.id}`"
          :key="t.id"
          type="button"
          role="tab"
          class="tab"
          :aria-selected="tab === t.id"
          :aria-controls="`panel-${t.id}`"
          :tabindex="tab === t.id ? 0 : -1"
          @click="tab = t.id"
        >
          <AppIcon :name="t.icon" />
          <span class="tab-long">{{ t.label }}</span>
          <span class="tab-short" aria-hidden="true">{{ t.short }}</span>
          <span v-if="t.id === 'trips' && waiting" class="tab-count" :title="`${waiting} waiting for your answer`">{{ waiting }}</span>
        </button>
      </div>
    </header>

    <main class="stage">
      <section v-if="startError" class="welcome">
        <div class="welcome-card">
          <h2>Couldn't start</h2>
          <p class="welcome-lead">{{ startError }}</p>
          <div class="welcome-actions"><button type="button" class="primary" @click="start">Try again</button></div>
        </div>
      </section>

      <p v-else-if="!session" class="loading">Loading…</p>

      <WelcomeCard
        v-else-if="welcome"
        :key="preview?.id ?? 'new'"
        :profile="profile"
        :preview="preview"
        :bad-invite="badInvite"
        :can-cancel="Boolean(crew)"
        :busy="busy"
        @create="createCrew"
        @join="joinCrew"
        @cancel="cancelWelcome"
        @account="accountOpen = true"
      />

      <template v-else-if="crew">
      <!-- Board: kept mounted so the timeline keeps its scroll position -->
      <section v-show="tab === 'board'" id="panel-board" class="panel board-panel" role="tabpanel" aria-labelledby="tab-board">
        <div class="board">
          <div v-if="step" class="trip-nudge">
            <span>{{ step.text }}</span>
            <button v-if="step.button" type="button" class="primary" @click="runStep(step.kind)">{{ step.button }}</button>
          </div>
          <TripCountdown v-else :trips="trips" :forecasts="forecasts" />
          <div class="board-top">
            <h2 class="board-title">Availability board</h2>
            <button type="button" class="invite-button" :disabled="people.length >= MAX_PEOPLE" @click="copyInvite">
              <AppIcon name="plus" /> Invite
            </button>
            <details class="board-key">
              <summary>Calendar key</summary>
              <div class="legend">
              <span><i class="sw sw-weekend" /> Weekend</span>
              <span><i class="sw sw-holiday" /> Holiday</span>
              <span v-for="k in KEY_DATES" :key="k.name"><i class="sw sw-key" /> {{ k.name }}</span>
              <span><i class="sw sw-free" /> Free</span>
              <span><i class="sw sw-fresh" /> Fresh snow</span>
              <span><i class="sw sw-all" /> Everyone free</span>
            </div>
            </details>
            <span v-if="store.kind === 'local'" class="demo">Demo: saved in this browser only</span>
          </div>
          <AvailabilityTimeline
            ref="timeline"
            :days="days"
            :people="people"
            :editable="editable"
            :counts="counts"
            :focused="focused"
            :highlight="highlight"
            :resort-id="resortId"
            :forecast="forecasts?.[resortId] ?? null"
            @resort="pickResort"
            @change="change"
            @focus="(d) => (focused = d)"
            @manage="accountOpen = true"
          />

          <section v-if="focusInfo" class="day-strip" :aria-label="formatLong(focusInfo.day)">
            <div class="day-strip-who">
              <h3>{{ formatLong(focusInfo.day) }}</h3>
              <span v-if="focusInfo.mark.holiday" class="tag holiday-tag">{{ focusInfo.mark.holiday }}</span>
              <span v-if="focusInfo.mark.keyDate" class="tag key-tag">{{ focusInfo.mark.keyDate }}</span>
              <span class="day-strip-free">
                <strong>{{ focusInfo.free.length }} of {{ people.length }}</strong> free<template v-if="focusInfo.free.length">:</template>
                <span v-for="p in focusInfo.free" :key="p.id" class="who">{{ p.emoji }} {{ p.name }}</span>
              </span>
              <button type="button" class="ghost icon-only day-strip-close" aria-label="Close day details" @click="focused = null">
                <AppIcon name="close" />
              </button>
            </div>
            <ul v-if="focusInfo.weather.length" class="day-strip-snow">
              <li v-for="x in focusInfo.weather" :key="x.resort.id" :class="{ fresh: x.w.snowCm >= 5 }">
                <AppIcon :name="x.w.kind" :size="16" />
                <span class="fc-resort">{{ x.resort.name }}</span>
                <span class="fc-num">{{ x.w.snowCm ? `${x.w.snowCm} cm` : '–' }}</span>
                <span class="fc-num muted">{{ x.w.tMin }}°/{{ x.w.tMax }}°</span>
              </li>
            </ul>
            <p v-else class="muted-note">No forecast yet: forecasts reach 16 days ahead.</p>
          </section>
          <section v-else-if="people.length < 2" class="solo-band">
            <img :src="art + 'rufus-snowboard@512.png'" alt="" width="96" height="96" />
            <div>
              <h3>Bring the crew</h3>
              <p>Copy the invite link and send it to the people you ski with. Mark your own free days meanwhile: tap a day in your row, or drag across a stretch.</p>
            </div>
            <button type="button" class="primary" @click="copyInvite">Copy invite link</button>
          </section>
          <p v-else class="board-hint">
            Tap or drag across your row to mark free days; they're the same in every crew. Tap any day for who's free and the snow.
            <em>Snow windows</em> lists the best stretches.
          </p>
        </div>

      </section>
      <section v-if="tab === 'windows'" id="panel-windows" class="panel split" role="tabpanel" aria-labelledby="tab-windows">
        <BestWindows :counts="counts" :people="marked" :waiting="people.length - marked" @pick="pickWindow" @suggest="suggestFrom" />
        <section class="holidays">
          <h2>Holidays &amp; dates</h2>
          <ul>
            <li v-for="h in HOLIDAYS" :key="h.date">
              <button type="button" @click="showOnBoard(h.date)">
                <span class="hdate">{{ formatLong(h.date) }}</span> {{ h.name }}
                <small>{{ h.scope }}</small>
              </button>
            </li>
            <li v-for="k in KEY_DATES" :key="k.name">
              <button type="button" @click="showOnBoard(k.start, { start: k.start, end: k.end })">
                <span class="hdate key">{{ formatDayMonth(k.start) }} – {{ formatDayMonth(k.end) }}</span> {{ k.name }}
              </button>
            </li>
          </ul>
        </section>
      </section>

      <section v-if="tab === 'trips'" id="panel-trips" class="panel" role="tabpanel" aria-labelledby="tab-trips">
        <TripsTab
          :view="tripsView"
          :trips="trips"
          :days="days"
          :people="people"
          :editable="editable"
          :mine="mine"
          :counts="counts"
          :forecasts="forecasts"
          :resort-id="resortId"
          :range="tripRange"
          :busy="busy"
          :fresh="freshTrip"
          :crew-name="crew?.name ?? ''"
          :crew-url="crewUrl"
          @view="(v) => (tripsPicked = v)"
          @range="(r) => (tripRange = r)"
          @create="createTrip"
          @respond="respond"
          @status="setStatus"
          @show="(r) => showOnBoard(r.start, r)"
          @announce="announce"
          @stay="stayAction"
        />
      </section>

      <section v-if="tab === 'resorts'" id="panel-resorts" class="panel scroll-panel" role="tabpanel" aria-labelledby="tab-resorts">
        <ResortsTab :forecasts="forecasts" :resort-id="resortId" :error="forecastError" @use="useResort" />
        <p class="credits">
          Weather from <a href="https://open-meteo.com/" rel="noopener" target="_blank">Open-Meteo</a>, 16 days ahead, refreshed every 30 minutes.
          Webcams open on each resort's own site.
          Crews hold up to {{ MAX_PEOPLE }} people; anyone with a crew's invite link can join it.
        </p>
      </section>
      </template>
    </main>

    <CrewSheet
      v-if="session && crew"
      :open="crewOpen"
      :crews="crews"
      :crew="crew"
      :people="people"
      :me="me"
      :guest="session.guest"
      :busy="busy"
      @close="crewOpen = false"
      @select="pickCrew"
      @create="newCrew"
      @account="openAccount"
      @rename="renameCrew"
      @copy="copyInvite"
      @reset="resetInvite"
      @remove="removeMember"
      @leave="leaveCrew"
    />

    <AccountDialog
      v-if="session"
      :open="accountOpen"
      :session="session"
      :profile="profile"
      :busy="busy"
      :google="store.kind === 'shared'"
      :taken="people.filter((p) => p.id !== me)"
      @close="accountOpen = false"
      @profile="saveProfile"
      @save="saveAccount"
      @sign-in="signIn"
      @google="google"
      @sign-out="signOut"
    />

    <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="false">{{ announced.join(' ') }}</div>
    <div v-if="toast" class="toast" :class="{ error: toast.error }" aria-hidden="true">{{ toast.text }}</div>
  </div>
</template>
