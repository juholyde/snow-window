<script setup lang="ts">
import { computed, ref } from 'vue'
import { RESORTS } from '../config/resorts'
import { addDays, type Day, formatLong } from '../lib/dates'
import type { Person } from '../lib/overlap'
import { tripSummary } from '../lib/share'
import { type Answer, coverage, nights, type StayAction, type Trip, type TripStatus, tally } from '../lib/trips'
import type { DayWeather } from '../lib/weather'
import AppIcon from './AppIcon.vue'
import StayPanel from './StayPanel.vue'

const props = defineProps<{
  trip: Trip
  people: Person[]
  mine: Person[]
  forecast: Record<Day, DayWeather> | null
  busy: boolean
  crewName: string
  crewUrl: string
}>()
const emit = defineEmits<{
  respond: [personId: string, answer: Answer]
  status: [personId: string, status: TripStatus]
  show: []
  stay: [action: StayAction]
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

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copySummary() {
  const text = tripSummary(props.trip, props.people, props.crewName, props.crewUrl)
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    window.prompt('Copy this summary:', text)
    return
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2500)
}

const base = import.meta.env.BASE_URL
const unanswered = computed(() => !closed.value && props.mine.some((p) => !props.trip.responses[p.id]))

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
  <article class="trip" :class="[trip.status, { waiting: unanswered }]">
    <img
      v-if="resort"
      class="trip-photo"
      :src="base + resort.photo.file"
      :alt="`${resort.name} in winter`"
      loading="lazy"
      width="960"
      height="720"
    />
    <div class="trip-body">
      <header class="trip-head">
        <div>
          <h3>{{ trip.title || resort?.name }}</h3>
          <p class="trip-sub">
            {{ dates }} · {{ n === 0 ? 'day trip' : `${n} ${n === 1 ? 'night' : 'nights'}` }}<template v-if="trip.title"> · {{ resort?.name }}</template>
          </p>
        </div>
        <span v-if="trip.status === 'on'" class="badge on">It's on</span>
        <span v-else-if="closed" class="badge off">Cancelled</span>
        <span v-else-if="unanswered" class="badge ask">Your answer?</span>
      </header>

      <div v-if="!closed && mine.length" class="answer-rows">
        <div v-for="me in mine" :key="me.id" class="answer-row">
          <span class="as"><span aria-hidden="true">{{ me.emoji }}</span><span>{{ mine.length > 1 ? me.name : 'You' }}</span></span>
          <fieldset class="seg answer" :aria-label="`${me.name}'s answer`">
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

      <ul class="tally">
        <li v-for="g in GROUPS" :key="g.id" :class="`g-${g.id}`">
          <span class="tally-label">{{ g.label }} <strong>{{ t[g.id].length }}</strong></span>
          <span v-for="p in t[g.id]" :key="p.id" class="who-chip" :title="p.name">{{ p.emoji }}</span>
        </li>
      </ul>

      <p class="trip-meta">
        <span>Suggested by {{ proposer?.emoji }} {{ proposer?.name ?? 'someone who left' }}</span>
        <span>
          Free for all of it: <span v-for="p in cover.free" :key="p.id" :title="p.name">{{ p.emoji }}</span>
          <template v-if="!cover.free.length">nobody yet</template>
        </span>
        <span v-if="snow !== null" class="snow-tag" :class="{ fresh: snow >= 5 }">
          <AppIcon name="snow" :size="14" /> {{ snow }} cm forecast
        </span>
      </p>
      <p v-if="trip.note" class="trip-note">{{ trip.note }}</p>

      <StayPanel v-if="trip.status === 'on' && n > 0" :trip="trip" :people="people" :me="mine[0]?.id ?? null" :busy="busy" @act="(a) => emit('stay', a)" />
      <p v-else-if="trip.status === 'open' && n > 0" class="hint stay-later">Where to stay opens once {{ isMine ? 'you mark' : 'the proposer marks' }} it on.</p>

      <footer class="trip-actions">
        <button type="button" class="ghost" @click="emit('show')">Show on board</button>
        <button v-if="trip.status === 'on'" type="button" class="ghost" @click="copySummary">
          <AppIcon :name="copied ? 'check' : 'copy'" :size="15" /> {{ copied ? 'Summary copied' : 'Copy summary' }}
        </button>
        <template v-if="isMine">
          <button v-if="trip.status === 'open'" type="button" class="primary" @click="emit('status', trip.proposerId, 'on')">
            Mark it on
          </button>
          <button v-if="trip.status !== 'open'" type="button" class="ghost" @click="emit('status', trip.proposerId, 'open')">
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
    </div>
  </article>
</template>
