<script setup lang="ts">
import { computed } from 'vue'
import type { Leg, Resort } from '../config/resorts'
import AppIcon from './AppIcon.vue'

/** Car, bus and train from Barcelona for one resort, plus its travel note. */
const props = defineProps<{ resort: Resort }>()

const hm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
type Mode = {
  id: 'car' | 'bus' | 'train'
  label: string
  leg: { minutes: number; detail: string; route: string; estimate: boolean } | null
}
const leg = (l: Leg) =>
  l && {
    minutes: l.minutes,
    detail: l.runs ? 'seasonal' : l.kind === 'direct' ? 'direct' : 'change',
    route: l.runs ? `${l.route}. Runs ${l.runs}` : l.route,
    estimate: l.checked === 'estimate',
  }
const modes = computed<Mode[]>(() => {
  const t = props.resort.travel
  return [
    { id: 'car', label: 'Car', leg: { minutes: t.car.minutes, detail: `${t.car.km} km`, route: t.car.route, estimate: false } },
    { id: 'bus', label: 'Bus', leg: leg(t.bus) },
    { id: 'train', label: 'Train', leg: leg(t.train) },
  ]
})
</script>

<template>
  <ul class="travel" :aria-label="`Getting to ${resort.name} from Barcelona`">
    <li
      v-for="m in modes"
      :key="m.id"
      :class="[`t-${m.id}`, { none: !m.leg }]"
      :title="m.leg ? `${m.label}: ${m.leg.route}${m.leg.estimate ? ' (estimate, no 2026-27 timetable found)' : ''}` : `No ${m.label.toLowerCase()} route`"
    >
      <span class="t-icon"><AppIcon :name="m.id" :size="16" /></span>
      <span v-if="m.leg" class="t-time">
        <strong>{{ m.leg.estimate ? '≈' : '' }}{{ hm(m.leg.minutes) }}</strong>
        <small>{{ m.leg.detail }}</small>
      </span>
      <span v-else class="t-time"><small>none</small></span>
    </li>
  </ul>
  <p v-if="resort.travel.note" class="t-note">{{ resort.travel.note }}</p>
</template>
