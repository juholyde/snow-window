<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { SEASON } from '../config/calendar'
import { RESORTS } from '../config/resorts'
import { type Day, formatLong } from '../lib/dates'
import type { Person } from '../lib/overlap'
import { coverage, datePicks, nights, type TripDraft } from '../lib/trips'

const props = defineProps<{
  people: Person[]
  mine: Person[]
  counts: Map<Day, number>
  resortId: string
  prefill: { start: Day; end: Day } | null
  busy: boolean
}>()
const emit = defineEmits<{ create: [personId: string, draft: TripDraft]; cancel: [] }>()

const as = ref(props.mine[0]?.id ?? '')
const kind = ref<'day' | 'multi'>(props.prefill && props.prefill.end > props.prefill.start ? 'multi' : 'day')
const d = reactive<TripDraft>({
  resortId: props.resortId,
  start: props.prefill?.start ?? '',
  end: props.prefill?.end ?? '',
  title: '',
  note: '',
  stayUrl: '',
  stayPrice: null,
  stayNote: '',
})

const picks = computed(() => datePicks(kind.value, props.counts))
function pick(start: Day, end: Day) {
  d.start = start
  d.end = end
}
// A day trip is one day: keep the end on the start.
watch([kind, () => d.start], () => {
  if (kind.value === 'day') d.end = d.start
  else if (d.start && (!d.end || d.end <= d.start)) d.end = ''
})

const ready = computed(() => Boolean(as.value && d.start && d.end && d.end >= d.start))
const cover = computed(() => (ready.value ? coverage({ start: d.start, end: d.end }, props.people) : null))
const n = computed(() => (ready.value ? nights({ start: d.start, end: d.end }) : 0))

function submit() {
  if (!ready.value) return
  emit('create', as.value, { ...d })
}
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <header class="composer-head">
      <h2>Suggest a trip</h2>
      <button type="button" class="ghost" @click="emit('cancel')">Close</button>
    </header>

    <label v-if="mine.length > 1" class="field">
      <span>Suggest as</span>
      <select v-model="as">
        <option v-for="p in mine" :key="p.id" :value="p.id">{{ p.emoji }} {{ p.name }}</option>
      </select>
    </label>

    <div class="seg" role="radiogroup" aria-label="Trip length">
      <label :class="{ on: kind === 'day' }"><input v-model="kind" type="radio" value="day" /> Day trip</label>
      <label :class="{ on: kind === 'multi' }"><input v-model="kind" type="radio" value="multi" /> Several days</label>
    </div>

    <fieldset class="field">
      <legend>When</legend>
      <div v-if="picks.length" class="picks">
        <button
          v-for="p in picks"
          :key="p.start"
          type="button"
          class="pick"
          :class="{ on: d.start === p.start && d.end === p.end }"
          @click="pick(p.start, p.end)"
        >
          <strong>{{ p.start === p.end ? formatLong(p.start) : `${formatLong(p.start)} – ${formatLong(p.end)}` }}</strong>
          <small>{{ p.people }} free</small>
        </button>
      </div>
      <p v-else class="hint">No day has two people free yet. Pick dates yourself:</p>
      <div class="dates-in">
        <label>
          <span>{{ kind === 'day' ? 'Day' : 'From' }}</span>
          <input v-model="d.start" type="date" :min="SEASON.start" :max="SEASON.end" required />
        </label>
        <label v-if="kind === 'multi'">
          <span>To</span>
          <input v-model="d.end" type="date" :min="d.start || SEASON.start" :max="SEASON.end" required />
        </label>
      </div>
    </fieldset>

    <p v-if="cover" class="cover">
      <strong>{{ cover.free.length }} free</strong> for all of it<template v-if="cover.free.length">:
        <span v-for="p in cover.free" :key="p.id">{{ p.emoji }}</span></template>
      <template v-if="cover.miss.length">
        · <span class="miss">misses some: <span v-for="p in cover.miss" :key="p.id">{{ p.emoji }}</span></span>
      </template>
    </p>

    <label class="field">
      <span>Resort</span>
      <select v-model="d.resortId">
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

    <fieldset v-if="kind === 'multi'" class="field stay">
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

    <button type="submit" class="primary" :disabled="busy || !ready">Suggest to the group</button>
  </form>
</template>
