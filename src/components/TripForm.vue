<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { RESORTS } from '../config/resorts'
import { formatLong } from '../lib/dates'
import type { Person } from '../lib/overlap'
import type { Range } from '../lib/selection'
import { coverage, nights, type TripDraft } from '../lib/trips'

/** A suggestion: dates picked on the timeline beside it, a resort and a plan. Where to stay comes once it's on. */
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
const d = reactive({ title: '', note: '' })

const n = computed(() => (props.range ? nights(props.range) : 0))
const cover = computed(() => (props.range ? coverage(props.range, props.people) : null))
const when = computed(() => {
  const r = props.range
  if (!r) return null
  return r.start === r.end ? formatLong(r.start) : `${formatLong(r.start)} – ${formatLong(r.end)}`
})

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

    <fieldset class="field resort-chips">
      <legend>Resort <small>the timeline shows its forecast</small></legend>
      <div class="chips">
        <label v-for="r in RESORTS" :key="r.id" class="chip" :class="{ on: r.id === resortId }">
          <input type="radio" name="resort" :value="r.id" :checked="r.id === resortId" @change="emit('resort', r.id)" />
          {{ r.name }}
        </label>
      </div>
    </fieldset>
    <label class="field">
      <span>Title <small>optional</small></span>
      <input v-model="d.title" type="text" maxlength="60" placeholder="Easter powder run" />
    </label>
    <label class="field">
      <span>Plan and wishes <small>optional</small></span>
      <textarea v-model="d.note" maxlength="500" rows="2" placeholder="Drive up Friday night. A flat with a sauna, near the lifts" />
    </label>
    <p v-if="n > 0" class="muted-note later-note">Where to stay comes once the crew agrees: you'll get a prompt to ask Claude for places.</p>

    <button type="submit" class="primary" :disabled="busy || !range || !as">Suggest to the crew</button>
  </form>
</template>
