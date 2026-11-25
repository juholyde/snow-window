<script setup lang="ts">
import { computed } from 'vue'
import { RESORTS } from '../config/resorts'
import { addDays, type Day, formatLong } from '../lib/dates'
import type { Person } from '../lib/overlap'
import { type Answer, coverage, nights, type Trip, type TripStatus, tally } from '../lib/trips'
import type { DayWeather } from '../lib/weather'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  trip: Trip
  people: Person[]
  mine: Person[]
  forecast: Record<Day, DayWeather> | null
}>()
const emit = defineEmits<{
  respond: [personId: string, answer: Answer]
  status: [personId: string, status: TripStatus]
  show: []
}>()

const resort = computed(() => RESORTS.find((r) => r.id === props.trip.resortId))
const proposer = computed(() => props.people.find((p) => p.id === props.trip.proposerId))
const n = computed(() => nights(props.trip))
const cover = computed(() => coverage(props.trip, props.people))
const t = computed(() => tally(props.trip, props.people))
const isMine = computed(() => props.mine.some((p) => p.id === props.trip.proposerId))
const closed = computed(() => props.trip.status === 'cancelled')
const dates = computed(() =>
  n.value === 0 ? formatLong(props.trip.start) : `${formatLong(props.trip.start)} – ${formatLong(props.trip.end)}`,
)
const snow = computed(() => {
  if (!props.forecast) return null
  let cm = 0
  let known = false
  for (let d = props.trip.start; d <= props.trip.end; d = addDays(d, 1)) {
    const w = props.forecast[d]
    if (w) {
      known = true
      cm += w.snowCm
    }
  }
  return known ? cm : null
})

const ANSWERS: { id: Answer; label: string }[] = [
  { id: 'yes', label: 'Going' },
  { id: 'maybe', label: 'Maybe' },
  { id: 'no', label: "Can't" },
]
const GROUPS: { id: Answer | 'none'; label: string }[] = [
  { id: 'yes', label: 'Going' },
  { id: 'maybe', label: 'Maybe' },
  { id: 'no', label: "Can't" },
  { id: 'none', label: 'No answer' },
]
</script>

<template>
  <article class="trip" :class="trip.status">
    <header class="trip-head">
      <div class="trip-when">
        <span class="trip-len" :class="{ day: n === 0 }">
          <strong>{{ n === 0 ? 1 : n }}</strong>{{ n === 0 ? 'day' : n === 1 ? 'night' : 'nights' }}
        </span>
        <div>
          <h3>{{ trip.title || resort?.name }}</h3>
          <p class="trip-sub">
            {{ dates }}<template v-if="trip.title"> · {{ resort?.name }}</template>
          </p>
        </div>
      </div>
      <span v-if="trip.status === 'on'" class="badge on">It's on</span>
      <span v-else-if="closed" class="badge off">Cancelled</span>
    </header>

    <p class="trip-meta">
      <span>Suggested by {{ proposer?.emoji }} {{ proposer?.name ?? 'someone who left' }}</span>
      <span v-if="snow !== null" class="snow-tag" :class="{ fresh: snow >= 5 }">
        <AppIcon name="snow" :size="14" /> {{ snow }} cm forecast
      </span>
    </p>
    <p v-if="trip.note" class="trip-note">{{ trip.note }}</p>

    <div v-if="trip.stayUrl || trip.stayPrice !== null || trip.stayNote" class="trip-stay">
      <strong>Stay</strong>
      <span v-if="trip.stayPrice !== null">
        €{{ trip.stayPrice }}/night · <strong>€{{ Math.round(trip.stayPrice * n) }}</strong> each for {{ n }}
        {{ n === 1 ? 'night' : 'nights' }}
      </span>
      <span v-if="trip.stayNote">{{ trip.stayNote }}</span>
      <a v-if="trip.stayUrl" :href="trip.stayUrl" target="_blank" rel="noopener noreferrer nofollow" class="cam">
        See the place <AppIcon name="external" :size="14" />
      </a>
    </div>

    <p class="trip-cover">
      Free for all of it: <span v-for="p in cover.free" :key="p.id" :title="p.name">{{ p.emoji }}</span>
      <template v-if="!cover.free.length">nobody yet</template>
      <template v-if="cover.miss.length">
        · misses some: <span v-for="p in cover.miss" :key="p.id" :title="p.name">{{ p.emoji }}</span>
      </template>
    </p>

    <dl class="tally">
      <div v-for="g in GROUPS" :key="g.id" :class="`g-${g.id}`">
        <dt>{{ g.label }} <span>{{ t[g.id].length }}</span></dt>
        <dd>
          <span v-for="p in t[g.id]" :key="p.id" class="who-chip" :title="p.name">{{ p.emoji }} {{ p.name }}</span>
        </dd>
      </div>
    </dl>

    <div v-if="!closed && mine.length" class="answer-rows">
      <div v-for="me in mine" :key="me.id" class="answer-row">
        <span class="as">{{ me.emoji }} {{ mine.length > 1 ? me.name : 'You' }}</span>
        <fieldset class="seg small" :aria-label="`${me.name}'s answer`">
          <button
            v-for="a in ANSWERS"
            :key="a.id"
            type="button"
            :class="[`a-${a.id}`, { on: trip.responses[me.id] === a.id }]"
            :aria-pressed="trip.responses[me.id] === a.id"
            @click="emit('respond', me.id, a.id)"
          >
            {{ a.label }}
          </button>
        </fieldset>
      </div>
    </div>
    <p v-else-if="!closed" class="hint">Add yourself on the Board to answer.</p>

    <footer class="trip-actions">
      <button type="button" class="ghost" @click="emit('show')">Show on board</button>
      <template v-if="isMine">
        <button
          v-if="trip.status === 'open'"
          type="button"
          class="primary"
          @click="emit('status', trip.proposerId, 'on')"
        >
          Mark it on
        </button>
        <button
          v-if="trip.status !== 'open'"
          type="button"
          class="ghost"
          @click="emit('status', trip.proposerId, 'open')"
        >
          Reopen
        </button>
        <button
          v-if="trip.status !== 'cancelled'"
          type="button"
          class="ghost danger"
          @click="emit('status', trip.proposerId, 'cancelled')"
        >
          Cancel trip
        </button>
      </template>
    </footer>
  </article>
</template>
