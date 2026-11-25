<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Day } from '../lib/dates'
import type { Person } from '../lib/overlap'
import type { Range } from '../lib/selection'
import { type Answer, sortTrips, type Trip, type TripDraft, type TripStatus } from '../lib/trips'
import type { Forecasts } from '../lib/weather'
import AvailabilityTimeline from './AvailabilityTimeline.vue'
import TripCard from './TripCard.vue'
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
  range: Range | null
  busy: boolean
}>()
const emit = defineEmits<{
  view: [view: TripsView]
  range: [range: Range | null]
  create: [personId: string, draft: TripDraft]
  respond: [tripId: string, personId: string, answer: Answer]
  status: [tripId: string, personId: string, status: TripStatus]
  show: [range: Range]
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

// The suggestion's resort drives the forecast row on its timeline.
const resort = ref(props.resortId)

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
      <div class="seg" role="tablist" aria-label="Trips view">
        <button
          type="button"
          role="tab"
          :aria-selected="view === 'suggest'"
          :class="{ on: view === 'suggest' }"
          @click="emit('view', 'suggest')"
        >
          Suggest
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="view === 'answer'"
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
          :forecast="forecasts?.[resort] ?? null"
          @resort="(id) => (resort = id)"
          @pick="(r) => emit('range', r)"
        />
      </div>
      <aside class="side">
        <TripForm
          v-if="mine.length"
          :people="people"
          :mine="mine"
          :range="range"
          :resort-id="resort"
          :busy="busy"
          @range="(r) => emit('range', r)"
          @resort="(id) => (resort = id)"
          @create="(pid, d) => emit('create', pid, d)"
        />
        <section v-else class="how">
          <h2>Suggest a trip</h2>
          <p>Add yourself on the Board first: trips are suggested, and answered, from your row.</p>
        </section>
      </aside>
    </div>

    <section v-else class="answer-view" aria-label="Suggested trips">
      <p v-if="!visible.length" class="empty">
        No trips yet. <button type="button" class="link-btn" @click="emit('view', 'suggest')">Suggest one</button>
        from the timeline, or from <em>Snow windows</em>.
      </p>
      <TripCard
        v-for="t in visible"
        :key="t.id"
        :trip="t"
        :people="people"
        :mine="mine"
        :forecast="forecasts?.[t.resortId] ?? null"
        @respond="(pid, a) => emit('respond', t.id, pid, a)"
        @status="(pid, s) => emit('status', t.id, pid, s)"
        @show="emit('show', { start: t.start, end: t.end })"
      />
    </section>
  </div>
</template>
