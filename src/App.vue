<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
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
import { type BoardStore, claimLink, parseClaim, TokenKeeper } from './lib/store'

const props = defineProps<{ store: BoardStore }>()

const tokens = new TokenKeeper(localStorage)
const days = eachDay(SEASON.start, SEASON.end)
const people = shallowRef<Person[]>([])
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
const hasRow = computed(() => editable.value.size > 0)

let toastTimer: ReturnType<typeof setTimeout> | undefined
function say(text: string, error = false) {
  toast.value = { text, error }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), error ? 6000 : 3500)
}

async function refresh() {
  try {
    people.value = await props.store.load()
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

function pickWindow(w: TripWindow) {
  highlight.value = { start: w.start, end: w.end }
  focused.value = w.start
  timeline.value?.scrollToDay(w.start)
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
  <header class="hero">
    <div class="hero-inner">
      <h1>Snow Window</h1>
      <p class="lede">
        Add yourself, mark the days you could ski or ride this season, and see when the whole crew is free.
        <span class="where">Pyrenees · Andorra · Sierra Nevada · Dec 2026 – Apr 2027</span>
      </p>
    </div>
    <svg class="range" viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <circle class="sun" cx="1130" cy="86" r="46" />
      <path class="far" d="M0 260V150l120-52 90 38 150-96 110 70 80-34 140 88 120-74 110 44 170-112 120 82 90-30 140 70V260Z" />
      <path class="far-snow" d="M332 58L360 40l28 18-14-4-12 8-14-9zM1057 44l33-22 32 22-16-4-14 10-16-9z" />
      <path class="near" d="M0 260V196l160-70 140 64 120-44 160 82 140-58 170 54 130-80 190 72 130-30V260Z" />
      <path class="near-snow" d="M123 142l37-16 35 16-17-3-16 8-20-8zM994 160l26-16 42 16-18-4-18 8-18-8z" />
      <path class="ground" d="M0 260v-26c240-20 480-24 720-14s480 12 720-6v46Z" />
    </svg>
  </header>

  <main>
    <p v-if="store.kind === 'local'" class="demo">
      Demo mode: this board is saved in this browser only.
    </p>

    <div class="legend">
      <span><i class="sw sw-weekend" /> Weekend</span>
      <span><i class="sw sw-holiday" /> Holiday (Spain, Catalonia)</span>
      <span v-for="k in KEY_DATES" :key="k.name">
        <i class="sw sw-key" /> {{ k.name }} · {{ formatDayMonth(k.start) }}–{{ formatDayMonth(k.end) }}
      </span>
      <span><i class="sw sw-free" /> Free</span>
      <span><i class="sw sw-fresh" /> Fresh snow ≥ 5 cm</span>
      <span><i class="sw sw-all" /> Everyone free</span>
    </div>

    <section class="board" aria-label="Availability timeline">
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
      <div class="board-foot">
        <AddPerson :full="people.length >= MAX_PEOPLE" :busy="busy" @add="add" />
        <p v-if="loaded && hasRow" class="tip">
          Tap a day in your row to toggle it, or drag to fill a stretch. Drag from a marked day to clear.
        </p>
        <p v-else-if="loaded && !people.length" class="tip">Nobody's here yet. Be the first.</p>
      </div>
    </section>

    <div v-if="managed" class="manage-panel" role="dialog" :aria-label="`Options for ${managed.name}`">
      <span class="avatar">{{ managed.emoji }}</span>
      <strong>{{ managed.name }}</strong>
      <button type="button" class="ghost" @click="copyLink(managed)">Copy edit link for another device</button>
      <button type="button" class="ghost danger" @click="remove(managed)">Remove my row</button>
      <button type="button" class="ghost icon-only" aria-label="Close" @click="managing = null"><AppIcon name="close" /></button>
    </div>

    <div class="below">
      <section v-if="focusInfo" class="day-card" aria-live="polite">
        <h2>{{ formatLong(focusInfo.day) }}</h2>
        <p class="marks">
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
        <p v-else class="muted-note">No forecast for this day yet: forecasts reach 16 days ahead.</p>
      </section>
      <BestWindows :counts="counts" :people="marked" :waiting="people.length - marked" @pick="pickWindow" />
      <section class="holidays">
        <h2>Holidays this season</h2>
        <ul>
          <li v-for="h in HOLIDAYS" :key="h.date">
            <button type="button" @click="focused = h.date; timeline?.scrollToDay(h.date)">
              <span class="hdate">{{ formatLong(h.date) }}</span> {{ h.name }}
              <small>{{ h.scope }}</small>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </main>

  <footer class="foot">
    <p v-if="forecastError" class="fc-error">Couldn't reach the weather service. Showing the last forecast, if there is one.</p>
    <p>No sign-in: anyone with the link can add a row; only the device that made a row can change it. Up to {{ MAX_PEOPLE }} people.</p>
    <p>Weather from <a href="https://open-meteo.com/" rel="noopener">Open-Meteo</a>, 16 days ahead, refreshed every 30 minutes.</p>
  </footer>

  <div v-if="toast" class="toast" :class="{ error: toast.error }" role="status">{{ toast.text }}</div>
</template>
