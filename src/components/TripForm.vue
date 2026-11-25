<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { SEASON } from '../config/calendar'
import { RESORTS } from '../config/resorts'
import { addDays, formatLong } from '../lib/dates'
import type { Person } from '../lib/overlap'
import { type Range, span } from '../lib/selection'
import { coverage, MAX_TRIP_DAYS, nights, type TripDraft } from '../lib/trips'

/** The details of a suggestion. Its dates are picked on the timeline beside it (or typed here). */
const props = defineProps<{
  people: Person[]
  mine: Person[]
  range: Range | null
  resortId: string
  busy: boolean
}>()
const emit = defineEmits<{
  create: [personId: string, draft: TripDraft]
  range: [range: Range | null]
  resort: [id: string]
}>()

const as = ref(props.mine[0]?.id ?? '')
watch(
  () => props.mine,
  (m) => {
    if (!m.some((p) => p.id === as.value)) as.value = m[0]?.id ?? ''
  },
)
const d = reactive({ title: '', note: '', stayUrl: '', stayPrice: null as number | null, stayNote: '' })

const n = computed(() => (props.range ? nights(props.range) : 0))
const cover = computed(() => (props.range ? coverage(props.range, props.people) : null))
const when = computed(() => {
  const r = props.range
  if (!r) return null
  return r.start === r.end ? formatLong(r.start) : `${formatLong(r.start)} – ${formatLong(r.end)}`
})

// Typed dates go through the same rules as picked ones.
function setStart(v: string) {
  if (!v) return emit('range', null)
  const end = props.range && props.range.end >= v ? props.range.end : v
  emit('range', span(v, end, MAX_TRIP_DAYS))
}
function setEnd(v: string) {
  if (!props.range || !v) return
  emit('range', span(props.range.start, v, MAX_TRIP_DAYS))
}

function submit() {
  const r = props.range
  if (!r || !as.value) return
  emit('create', as.value, { ...d, resortId: props.resortId, start: r.start, end: r.end })
}
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <header class="pick-summary" :class="{ empty: !range }">
      <template v-if="range">
        <span class="trip-len" :class="{ day: n === 0 }">
          <strong>{{ n === 0 ? 1 : n }}</strong>{{ n === 0 ? 'day' : n === 1 ? 'night' : 'nights' }}
        </span>
        <div>
          <h2>{{ n === 0 ? 'Day trip' : 'Stay over' }}</h2>
          <p>{{ when }}</p>
        </div>
        <button type="button" class="ghost small-btn" @click="emit('range', null)">Clear</button>
      </template>
      <template v-else>
        <h2>Pick the dates</h2>
        <p>Tap the first day on the timeline, then the last. One tap is a day trip.</p>
      </template>
    </header>

    <p v-if="cover" class="cover">
      <strong>{{ cover.free.length }} free</strong> for all of it<template v-if="cover.free.length">:
        <span v-for="p in cover.free" :key="p.id" :title="p.name">{{ p.emoji }}</span></template>
      <template v-if="cover.miss.length">
        · <span class="miss">misses some: <span v-for="p in cover.miss" :key="p.id" :title="p.name">{{ p.emoji }}</span></span>
      </template>
    </p>

    <div class="dates-in">
      <label>
        <span>From</span>
        <input type="date" :value="range?.start ?? ''" :min="SEASON.start" :max="SEASON.end" @change="setStart(($event.target as HTMLInputElement).value)" />
      </label>
      <label>
        <span>To</span>
        <input
          type="date"
          :value="range?.end ?? ''"
          :disabled="!range"
          :min="range?.start ?? SEASON.start"
          :max="range ? addDays(range.start, MAX_TRIP_DAYS - 1) : SEASON.end"
          @change="setEnd(($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <label v-if="mine.length > 1" class="field">
      <span>Suggest as</span>
      <select v-model="as">
        <option v-for="p in mine" :key="p.id" :value="p.id">{{ p.emoji }} {{ p.name }}</option>
      </select>
    </label>
    <label class="field">
      <span>Resort <small>the timeline shows its forecast</small></span>
      <select :value="resortId" @change="emit('resort', ($event.target as HTMLSelectElement).value)">
        <option v-for="r in RESORTS" :key="r.id" :value="r.id">{{ r.name }} · {{ r.region }}</option>
      </select>
    </label>
    <label class="field">
      <span>Title <small>optional</small></span>
      <input v-model="d.title" type="text" maxlength="60" placeholder="Easter powder run" />
    </label>
    <label class="field">
      <span>Plan <small>optional</small></span>
      <textarea v-model="d.note" maxlength="500" rows="2" placeholder="Drive up Friday night, two cars…" />
    </label>

    <fieldset v-if="n > 0" class="field stay">
      <legend>Where to stay <small>optional · {{ n }} {{ n === 1 ? 'night' : 'nights' }}</small></legend>
      <label>
        <span>Link</span>
        <input v-model="d.stayUrl" type="url" inputmode="url" pattern="https://.*" placeholder="https://…" />
      </label>
      <label>
        <span>€ per person per night</span>
        <input v-model.number="d.stayPrice" type="number" min="0" step="1" inputmode="decimal" placeholder="45" />
      </label>
      <label>
        <span>Note</span>
        <input v-model="d.stayNote" type="text" maxlength="300" placeholder="Sleeps 6, 5 min from the lift" />
      </label>
    </fieldset>

    <button type="submit" class="primary" :disabled="busy || !range || !as">Suggest to the group</button>
  </form>
</template>
