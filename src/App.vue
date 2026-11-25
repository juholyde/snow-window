<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import AddPerson from './components/AddPerson.vue'
import BestWindows from './components/BestWindows.vue'
import AvailabilityTimeline from './components/AvailabilityTimeline.vue'
import { HOLIDAYS, KEY_DATES, SEASON } from './config/calendar'
import { type Day, eachDay, formatDayMonth, formatLong, todayLocal } from './lib/dates'
import { countByDay, markDay, type Person, type TripWindow } from './lib/overlap'
import { MAX_PEOPLE } from './lib/rules'
import { RESORTS } from './config/resorts'
import { type Forecasts, loadForecasts } from './lib/weather'
import AppIcon from './components/AppIcon.vue'
import ResortsTab from './components/ResortsTab.vue'
import TripsTab from './components/TripsTab.vue'
import type { Answer, Trip, TripDraft, TripStatus } from './lib/trips'
import { type BoardStore, claimLink, parseClaim, TokenKeeper } from './lib/store'

const props = defineProps<{ store: BoardStore }>()

const tokens = new TokenKeeper(localStorage)
const days = eachDay(SEASON.start, SEASON.end)
const people = shallowRef<Person[]>([])
const trips = shallowRef<Trip[]>([])
const loaded = ref(false)
const busy = ref(false)
const toast = ref<{ text: string; error?: boolean } | null>(null)
const focused = ref<Day | null>(null)
const highlight = ref<{ start: Day; end: Day } | null>(null)
const managing = ref<string | null>(null)
const tokenVersion = ref(0)
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

const editable = computed(() => {
  tokenVersion.value
  const mine = tokens.all()
  return new Set(people.value.filter((p) => mine[p.id]).map((p) => p.id))
})
const counts = computed(() => countByDay(people.value))
const marked = computed(() => people.value.filter((p) => p.days.length).length)

let toastTimer: ReturnType<typeof setTimeout> | undefined
function say(text: string, error = false) {
  toast.value = { text, error }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), error ? 6000 : 3500)
}

async function refresh() {
  try {
    const [p, t] = await Promise.all([props.store.load(), props.store.loadTrips()])
    people.value = p
    trips.value = t
    loaded.value = true
  } catch (e) {
    say(`Couldn't load the board: ${(e as Error).message}`, true)
  }
}

async function add(name: string, emoji: string) {
  busy.value = true
  try {
    const { person, token } = await props.store.addPerson(name, emoji)
    tokens.set(person.id, token)
    tokenVersion.value++
    await refresh()
    say(`Welcome ${person.emoji}! Tap or drag across your row to mark the days you can go.`)
  } catch (e) {
    say((e as Error).message, true)
  } finally {
    busy.value = false
  }
}

async function change(id: string, next: Day[]) {
  const token = tokens.get(id)
  if (!token) return
  const before = people.value
  people.value = before.map((p) => (p.id === id ? { ...p, days: next } : p))
  try {
    await props.store.setDays(id, token, next)
  } catch (e) {
    people.value = before
    say(`Not saved: ${(e as Error).message}`, true)
  }
}

const managed = computed(() => people.value.find((p) => p.id === managing.value) ?? null)

async function copyLink(p: Person) {
  const token = tokens.get(p.id)
  if (!token) return
  const link = claimLink(location.href, p.id, token)
  try {
    await navigator.clipboard.writeText(link)
    say('Link copied. Open it on your other device to edit your row there. Keep it to yourself.')
  } catch {
    window.prompt('Copy this link to edit your row on another device:', link)
  }
}

async function remove(p: Person) {
  const token = tokens.get(p.id)
  if (!token || !window.confirm(`Remove ${p.name} and all their days from the board?`)) return
  try {
    await props.store.removePerson(p.id, token)
    tokens.forget(p.id)
    tokenVersion.value++
    managing.value = null
    await refresh()
  } catch (e) {
    say((e as Error).message, true)
  }
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

const mine = computed(() => people.value.filter((p) => editable.value.has(p.id)))
const composing = ref(false)
const prefill = ref<{ start: Day; end: Day } | null>(null)
const openTrips = computed(() => trips.value.filter((t) => t.status !== 'cancelled').length)

function suggestFrom(w: TripWindow) {
  prefill.value = { start: w.start, end: w.end }
  composing.value = true
  tab.value = 'trips'
}

async function tripAction(run: (token: string) => Promise<unknown>, personId: string, ok?: string) {
  const token = tokens.get(personId)
  if (!token) return false
  busy.value = true
  try {
    await run(token)
    trips.value = await props.store.loadTrips()
    if (ok) say(ok)
    return true
  } catch (e) {
    say((e as Error).message, true)
    return false
  } finally {
    busy.value = false
  }
}

async function createTrip(personId: string, draft: TripDraft) {
  const done = await tripAction((t) => props.store.createTrip(personId, t, draft), personId, 'Suggested. The group can answer now.')
  if (done) {
    composing.value = false
    prefill.value = null
  }
}
const respond = (tripId: string, personId: string, answer: Answer) =>
  tripAction((t) => props.store.respond(tripId, personId, t, answer), personId)
const setStatus = (tripId: string, personId: string, status: TripStatus) =>
  tripAction(
    (t) => props.store.setTripStatus(tripId, personId, t, status),
    personId,
    status === 'on' ? "It's on! Everyone can see it." : undefined,
  )

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

// Someone else's edits show up within half a minute, and at once when you come back to the tab.
let poll: ReturnType<typeof setInterval> | undefined
let weatherPoll: ReturnType<typeof setInterval> | undefined
const onVisible = () => {
  if (document.visibilityState !== 'visible') return
  refresh()
  refreshForecast()
}

onMounted(async () => {
  const claim = parseClaim(location.hash)
  if (claim) {
    tokens.set(claim.id, claim.token)
    tokenVersion.value++
    history.replaceState(null, '', location.pathname + location.search)
  }
  await refresh()
  if (claim) {
    const p = people.value.find((x) => x.id === claim.id)
    say(p ? `You can edit ${p.emoji} ${p.name} on this device now.` : 'That edit link is for a row that no longer exists.', !p)
  }
  const start = todayLocal() > SEASON.start && todayLocal() <= SEASON.end ? todayLocal() : SEASON.start
  timeline.value?.scrollToDay(start, false)
  poll = setInterval(refresh, 30_000)
  refreshForecast()
  weatherPoll = setInterval(refreshForecast, 30 * 60_000)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  clearInterval(poll)
  clearInterval(weatherPoll)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <svg class="topbar-range" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true">
        <circle class="sun" cx="1190" cy="30" r="17" />
        <path class="far" d="M0 64V44l120-16 90 10 150-28 110 20 80-10 140 24 120-20 110 12 170-30 120 22 90-8 140 18V64Z" />
        <path class="near" d="M0 64V54l160-16 140 14 120-10 160 18 140-14 170 12 130-18 190 16 130-6V64Z" />
      </svg>
      <div class="brand">
        <h1>Snow Window</h1>
        <p class="tagline">When can the crew ski? Dec 2026 – Apr 2027</p>
      </div>
      <div class="tabs" role="tablist" aria-label="Views" @keydown="onTabKey">
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
          <span v-if="t.id === 'trips' && openTrips" class="tab-count">{{ openTrips }}</span>
        </button>
      </div>
    </header>

    <main class="stage">
      <!-- Board: kept mounted so the timeline keeps its scroll position -->
      <section v-show="tab === 'board'" id="panel-board" class="panel board-panel" role="tabpanel" aria-labelledby="tab-board">
        <div class="board">
          <div class="board-top">
            <div class="legend">
              <span><i class="sw sw-weekend" /> Weekend</span>
              <span><i class="sw sw-holiday" /> Holiday</span>
              <span v-for="k in KEY_DATES" :key="k.name"><i class="sw sw-key" /> {{ k.name }}</span>
              <span><i class="sw sw-free" /> Free</span>
              <span><i class="sw sw-fresh" /> Fresh snow</span>
              <span><i class="sw sw-all" /> Everyone free</span>
            </div>
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
            @manage="(id) => (managing = managing === id ? null : id)"
          />
        </div>

        <aside class="side" aria-label="Details">
          <AddPerson :full="people.length >= MAX_PEOPLE" :busy="busy" @add="add" />

          <section v-if="managed" class="manage-panel" :aria-label="`Options for ${managed.name}`">
            <div class="manage-who">
              <span class="avatar">{{ managed.emoji }}</span>
              <strong>{{ managed.name }}</strong>
              <button type="button" class="ghost icon-only" aria-label="Close" @click="managing = null"><AppIcon name="close" /></button>
            </div>
            <button type="button" class="ghost" @click="copyLink(managed)">Copy edit link for another device</button>
            <button type="button" class="ghost danger" @click="remove(managed)">Remove my row</button>
          </section>

          <section v-if="focusInfo" class="day-card" aria-live="polite">
            <h2>{{ formatLong(focusInfo.day) }}</h2>
            <p v-if="focusInfo.mark.holiday || focusInfo.mark.keyDate || focusInfo.mark.weekend" class="marks">
              <span v-if="focusInfo.mark.holiday" class="tag holiday-tag">{{ focusInfo.mark.holiday }}</span>
              <span v-if="focusInfo.mark.keyDate" class="tag key-tag">{{ focusInfo.mark.keyDate }}</span>
              <span v-if="focusInfo.mark.weekend" class="tag weekend-tag">Weekend</span>
            </p>
            <p v-if="!people.length">No one on the board yet.</p>
            <p v-else>
              <strong>{{ focusInfo.free.length }} of {{ people.length }}</strong> free<span v-if="focusInfo.free.length">:</span>
              <span v-for="p in focusInfo.free" :key="p.id" class="who">{{ p.emoji }} {{ p.name }}</span>
            </p>
            <ul v-if="focusInfo.weather.length" class="fc-list">
              <li v-for="x in focusInfo.weather" :key="x.resort.id" :class="{ fresh: x.w.snowCm >= 5 }">
                <AppIcon :name="x.w.kind" :size="18" />
                <span class="fc-resort">{{ x.resort.name }}</span>
                <span class="fc-num">{{ x.w.snowCm ? `${x.w.snowCm} cm` : '' }}</span>
                <span class="fc-num muted">{{ x.w.tMin }}° / {{ x.w.tMax }}°</span>
              </li>
            </ul>
            <p v-else class="muted-note">No forecast yet: forecasts reach 16 days ahead.</p>
          </section>
          <section v-else class="how">
            <h2>How it works</h2>
            <ol>
              <li>Add yourself with a name and an emoji.</li>
              <li>Tap a day in your row, or drag across a stretch, to mark when you're free.</li>
              <li>Orange days are when everyone's free. <em>Snow windows</em> lists the best stretches.</li>
              <li>Tap any day for who's free and the snow forecast.</li>
            </ol>
          </section>
        </aside>
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
          :trips="trips"
          :people="people"
          :mine="mine"
          :counts="counts"
          :forecasts="forecasts"
          :resort-id="resortId"
          :prefill="prefill"
          :composing="composing"
          :busy="busy"
          @create="createTrip"
          @respond="respond"
          @status="setStatus"
          @show="(r) => showOnBoard(r.start, r)"
          @compose="(open) => { composing = open; if (!open) prefill = null }"
        />
      </section>

      <section v-if="tab === 'resorts'" id="panel-resorts" class="panel scroll-panel" role="tabpanel" aria-labelledby="tab-resorts">
        <ResortsTab :forecasts="forecasts" :resort-id="resortId" :error="forecastError" @use="useResort" />
        <p class="credits">
          Weather from <a href="https://open-meteo.com/" rel="noopener" target="_blank">Open-Meteo</a>, 16 days ahead, refreshed every 30 minutes.
          Webcams open on each resort's own site.
          No sign-in: anyone with the link can add a row; only the device that made a row can change it. Up to {{ MAX_PEOPLE }} people.
        </p>
      </section>
    </main>

    <div v-if="toast" class="toast" :class="{ error: toast.error }" role="status">{{ toast.text }}</div>
  </div>
</template>
