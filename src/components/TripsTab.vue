<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { SEASON } from '../config/calendar'
import type { Resort } from '../config/resorts'
import { type Day, formatLong } from '../lib/dates'
import { type Person, stretchPicks } from '../lib/overlap'
import { type Range, span } from '../lib/selection'
import {
  type Answer,
  MAX_TRIP_DAYS,
  type CarAction,
  type StayAction,
  sortTrips,
  type Trip,
  type TripDraft,
  type TripStatus,
} from '../lib/trips'
import type { Forecasts } from '../lib/weather'
import AvailabilityTimeline from './AvailabilityTimeline.vue'
import TripCard from './TripCard.vue'
import TripCountdown from './TripCountdown.vue'
import TripForm from './TripForm.vue'

export type TripsView = 'suggest' | 'answer'

const props = defineProps<{
  view: TripsView
  trips: Trip[]
  days: Day[]
  people: Person[]
  editable: Set<string>
  mine: Person[]
  counts: Map<Day, number>
  forecasts: Forecasts | null
  resortId: string
  /** The current crew's resorts. */
  resorts: Resort[]
  homeCity: string | null
  range: Range | null
  busy: boolean
  fresh?: string | null
  crewName: string
  crewUrl: string
}>()
const emit = defineEmits<{
  view: [view: TripsView]
  range: [range: Range | null]
  create: [personId: string, draft: TripDraft]
  respond: [tripId: string, personId: string, answer: Answer]
  status: [tripId: string, personId: string, status: TripStatus]
  show: [range: Range]
  stay: [action: StayAction]
  car: [action: CarAction]
  announce: [text: string]
  account: []
}>()

// Opening Suggest with dates already picked (e.g. from Snow windows) brings them into view.
const timeline = ref<InstanceType<typeof AvailabilityTimeline> | null>(null)
watch(
  () => props.view,
  async (v) => {
    await nextTick()
    if (v === 'suggest' && props.range) timeline.value?.scrollToDay(props.range.start, false)
  },
  { immediate: true },
)

// Best stretches as one-tap picks under the timeline.
const best = computed(() => stretchPicks(SEASON, props.counts, props.people.filter((p) => p.days.length).length))
const art = `${import.meta.env.BASE_URL}art/`
const label = (r: Range) => (r.start === r.end ? formatLong(r.start) : `${formatLong(r.start)} – ${formatLong(r.end)}`)
const isPicked = (w: { start: Day; end: Day }) => props.range?.start === w.start && props.range?.end === span(w.start, w.end, MAX_TRIP_DAYS).end
function pickBest(start: Day, end: Day) {
  const r = span(start, end, MAX_TRIP_DAYS)
  emit('range', r)
  timeline.value?.scrollToDay(r.start)
}

// Arrow keys move between the Suggest and Answer tabs, as on the top-level tabs.
const VIEWS = ['suggest', 'answer'] as const
async function onViewKey(e: KeyboardEvent) {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  const next = VIEWS[(VIEWS.indexOf(props.view) + step + VIEWS.length) % VIEWS.length]
  if (!next) return
  e.preventDefault()
  emit('view', next)
  await nextTick()
  document.getElementById(`trips-view-${next}`)?.focus()
}

// The suggestion's resort drives the forecast row on its timeline.
const resort = ref(props.resortId)
// A crew's areas change: a pick outside them gives way to the first allowed resort.
watch(
  () => props.resorts,
  (rs) => {
    if (rs.length && !rs.some((r) => r.id === resort.value)) resort.value = rs[0]?.id ?? resort.value
  },
)

const showCancelled = ref(false)
const sorted = computed(() => sortTrips(props.trips))
const visible = computed(() => sorted.value.filter((t) => showCancelled.value || t.status !== 'cancelled'))
const cancelled = computed(() => props.trips.filter((t) => t.status === 'cancelled').length)
const waiting = computed(
  () => props.trips.filter((t) => t.status !== 'cancelled' && props.mine.some((p) => !t.responses[p.id])).length,
)
</script>

<template>
  <div class="trips">
    <div class="trips-bar">
      <div class="seg" role="tablist" aria-label="Trips view" @keydown="onViewKey">
        <button
          type="button"
          id="trips-view-suggest"
          role="tab"
          :aria-selected="view === 'suggest'"
          :tabindex="view === 'suggest' ? 0 : -1"
          :class="{ on: view === 'suggest' }"
          @click="emit('view', 'suggest')"
        >
          Suggest
        </button>
        <button
          type="button"
          id="trips-view-answer"
          role="tab"
          :aria-selected="view === 'answer'"
          :tabindex="view === 'answer' ? 0 : -1"
          :class="{ on: view === 'answer' }"
          @click="emit('view', 'answer')"
        >
          Answer <span v-if="waiting" class="tab-count">{{ waiting }}</span>
        </button>
      </div>
      <label v-if="view === 'answer' && cancelled" class="toggle">
        <input v-model="showCancelled" type="checkbox" /> Show {{ cancelled }} cancelled
      </label>
    </div>

    <div v-if="view === 'suggest'" class="suggest-view">
      <h2 class="visually-hidden">Pick the dates on the board</h2>
      <div class="board">
        <AvailabilityTimeline
          ref="timeline"
          mode="pick"
          :days="days"
          :people="people"
          :editable="editable"
          :counts="counts"
          :focused="null"
          :highlight="range"
          :resort-id="resort"
          :resorts="resorts"
          :forecast="forecasts?.[resort] ?? null"
          @resort="(id) => (resort = id)"
          @pick="(r) => emit('range', r)"
        />
        <div class="suggest-legend">
          <span><i class="sw sw-option" /> Someone's free</span>
          <span><i class="sw sw-fresh" /> Everyone's free</span>
          <span><i class="sw sw-picked" /> Your pick</span>
        </div>
        <section v-if="best.length" class="best-picks" aria-label="Best stretches">
          <h3>Best stretches <small>most people free first</small></h3>
          <div class="picks">
            <button
              v-for="w in best"
              :key="w.start"
              type="button"
              class="pick"
              :aria-pressed="isPicked(w)"
              :class="{ on: isPicked(w) }"
              @click="pickBest(w.start, w.end)"
            >
              <strong>{{ label(w) }}</strong>
              <small>{{ w.people }} free · {{ w.length === 1 ? '1 day' : `${w.length} days` }}</small>
            </button>
          </div>
        </section>
      </div>
      <aside class="side">
        <TripForm
          v-if="mine.length"
          :people="people"
          :mine="mine"
          :range="range"
          :resort-id="resort"
          :resorts="resorts"
          :home-city="homeCity"
          :busy="busy"
          @range="(r) => emit('range', r)"
          @resort="(id) => (resort = id)"
          @account="emit('account')"
          @create="(pid, d) => emit('create', pid, d)"
        />
        <section v-else class="how">
          <h2>Suggest a trip</h2>
          <p>Pick a name and an avatar first: trips are suggested, and answered, as you.</p>
        </section>
      </aside>
    </div>

    <section v-else class="answer-view" aria-label="Suggested trips">
      <h2 class="visually-hidden">Suggested trips</h2>
      <div v-if="!visible.length" class="empty empty-trips">
        <img :src="art + 'tycoon-skier@512.png'" alt="" width="150" height="150" />
        <div>
          <h3>No trips yet</h3>
          <p>
            <button type="button" class="link-btn" @click="emit('view', 'suggest')">Suggest one</button>
            from the timeline, or from <em>Snow windows</em>. Everyone answers Going, Maybe or Can't here.
          </p>
        </div>
      </div>
      <TripCountdown :trips="trips" :forecasts="forecasts" />
      <TripCard
        v-for="t in visible"
        :key="t.id"
        :trip="t"
        :people="people"
        :mine="mine"
        :forecast="forecasts?.[t.resortId] ?? null"
        :busy="busy"
        :fresh="fresh === t.id"
        :crew-name="crewName"
        :crew-url="crewUrl"
        @stay="(a) => emit('stay', a)"
        @car="(a) => emit('car', a)"
        @announce="(m) => emit('announce', m)"
        @respond="(pid, a) => emit('respond', t.id, pid, a)"
        @status="(pid, s) => emit('status', t.id, pid, s)"
        @show="emit('show', { start: t.start, end: t.end })"
      />
    </section>
  </div>
</template>
