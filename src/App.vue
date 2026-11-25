<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import AddPerson from './components/AddPerson.vue'
import BestWindows from './components/BestWindows.vue'
import AvailabilityTimeline from './components/AvailabilityTimeline.vue'
import { HOLIDAYS, KEY_DATES, SEASON } from './config/calendar'
import { type Day, eachDay, formatDayMonth, formatLong, todayLocal } from './lib/dates'
import { countByDay, markDay, type Person, type TripWindow } from './lib/overlap'
import { MAX_PEOPLE } from './lib/rules'
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
  return { day: d, mark: markDay(d), free }
})

// Someone else's edits show up within half a minute, and at once when you come back to the tab.
let poll: ReturnType<typeof setInterval> | undefined
const onVisible = () => document.visibilityState === 'visible' && refresh()

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
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  clearInterval(poll)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <header class="hero">
    <svg class="ridge" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 120 L0 78 L90 40 L150 62 L260 8 L340 58 L410 34 L520 86 L600 30 L700 70 L790 18 L880 64 L960 44 L1060 90 L1130 52 L1200 70 L1200 120 Z" />
      <path class="snowcap" d="M228 26 L260 8 L292 26 L276 22 L262 30 L246 22 Z M762 36 L790 18 L818 36 L804 32 L790 40 L776 32 Z" />
    </svg>
    <div class="hero-inner">
      <p class="eyebrow">Season 2026–27 · Pyrenees, Sierra Nevada &amp; Andorra</p>
      <h1>Snow Window</h1>
      <p class="lede">Add yourself, mark the days you could go skiing or riding, and see when the whole crew is free.</p>
    </div>
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
      <button type="button" class="ghost" aria-label="Close" @click="managing = null">✕</button>
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
    No sign-in: anyone with the link can add a row; only the device that made a row can change it. Up to {{ MAX_PEOPLE }} people.
  </footer>

  <div v-if="toast" class="toast" :class="{ error: toast.error }" role="status">{{ toast.text }}</div>
</template>
