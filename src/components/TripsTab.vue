<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Day } from '../lib/dates'
import type { Person } from '../lib/overlap'
import { type Answer, sortTrips, type Trip, type TripDraft, type TripStatus } from '../lib/trips'
import type { Forecasts } from '../lib/weather'
import AppIcon from './AppIcon.vue'
import TripCard from './TripCard.vue'
import TripComposer from './TripComposer.vue'

const props = defineProps<{
  trips: Trip[]
  people: Person[]
  mine: Person[]
  counts: Map<Day, number>
  forecasts: Forecasts | null
  resortId: string
  /** Dates handed over from Snow windows: opens the composer on them. */
  prefill: { start: Day; end: Day } | null
  composing: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  create: [personId: string, draft: TripDraft]
  respond: [tripId: string, personId: string, answer: Answer]
  status: [tripId: string, personId: string, status: TripStatus]
  show: [range: { start: Day; end: Day }]
  compose: [open: boolean]
}>()

const showCancelled = ref(false)
const sorted = computed(() => sortTrips(props.trips))
const visible = computed(() => sorted.value.filter((t) => showCancelled.value || t.status !== 'cancelled'))
const cancelled = computed(() => props.trips.filter((t) => t.status === 'cancelled').length)
</script>

<template>
  <div class="trips">
    <section class="trip-list" aria-label="Suggested trips">
      <header class="list-head">
        <h2>Trips</h2>
        <label v-if="cancelled" class="toggle">
          <input v-model="showCancelled" type="checkbox" /> Show {{ cancelled }} cancelled
        </label>
      </header>
      <p v-if="!visible.length" class="empty">
        No trips suggested yet. Pick a stretch on the right, or from <em>Snow windows</em>, and put it to the group.
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

    <aside class="trip-side">
      <TripComposer
        v-if="composing && mine.length"
        :key="prefill ? `${prefill.start}-${prefill.end}` : 'new'"
        :people="people"
        :mine="mine"
        :counts="counts"
        :resort-id="resortId"
        :prefill="prefill"
        :busy="busy"
        @create="(pid, d) => emit('create', pid, d)"
        @cancel="emit('compose', false)"
      />
      <section v-else class="how">
        <h2>Plan a trip</h2>
        <p v-if="!mine.length">Add yourself on the Board first; trips are suggested from your row.</p>
        <template v-else>
          <p>Pick a day trip or a few days, a resort and, if you're staying over, a place. Everyone answers Going, Maybe or Can't.</p>
          <button type="button" class="add-open" @click="emit('compose', true)">
            <AppIcon name="plus" /> Suggest a trip
          </button>
        </template>
      </section>
    </aside>
  </div>
</template>
