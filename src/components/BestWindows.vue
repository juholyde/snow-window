<script setup lang="ts">
import { computed } from 'vue'
import { SEASON } from '../config/calendar'
import { type Day, formatLong } from '../lib/dates'
import { bestWindows, type TripWindow } from '../lib/overlap'

const props = defineProps<{ counts: Map<Day, number>; people: number; waiting: number }>()
const emit = defineEmits<{ pick: [w: TripWindow]; suggest: [w: TripWindow] }>()

const result = computed(() => bestWindows(SEASON, props.counts, props.people))

function range(w: TripWindow) {
  return w.length === 1 ? formatLong(w.start) : `${formatLong(w.start)} – ${formatLong(w.end)}`
}
</script>

<template>
  <section class="windows" aria-labelledby="windows-title">
    <header>
      <h2 id="windows-title">Snow windows</h2>
      <p v-if="people < 2">Once two people have marked days, the stretches when you're all free show up here.</p>
      <p v-else-if="!result.windows.length">No day has two people free yet.</p>
      <p v-else-if="result.need === people">Stretches when <strong>all {{ people }}</strong> of you are free.</p>
      <p v-else>
        No day suits everyone yet. Best so far: <strong>{{ result.need }} of {{ people }}</strong> free.
      </p>
      <p v-if="waiting" class="waiting">
        {{ waiting }} {{ waiting === 1 ? "person hasn't" : "people haven't" }} marked any days yet and {{ waiting === 1 ? "isn't" : "aren't" }} counted.
      </p>
    </header>
    <ol v-if="result.windows.length">
      <li v-for="w in result.windows" :key="w.start" class="window-row">
        <button type="button" class="window" @click="emit('pick', w)">
          <span class="len" :class="{ day: w.length === 1 }">
            <strong>{{ w.length }}</strong>
            {{ w.length === 1 ? 'day' : 'days' }}
          </span>
          <span class="what">
            <span class="dates">{{ range(w) }}</span>
            <span class="tags">
              <span v-if="w.length === 1" class="tag">Day trip</span>
              <span v-else class="tag">{{ w.length - 1 }} {{ w.length === 2 ? 'night' : 'nights' }}</span>
              <span v-if="w.weekendDays" class="tag weekend-tag">{{ w.weekendDays }} weekend</span>
              <span v-for="h in w.holidays" :key="h" class="tag holiday-tag">{{ h }}</span>
              <span v-for="k in w.keyDates" :key="k" class="tag key-tag">{{ k }}</span>
            </span>
          </span>
        </button>
        <button type="button" class="ghost suggest" @click="emit('suggest', w)">Suggest trip</button>
      </li>
    </ol>
  </section>
</template>
