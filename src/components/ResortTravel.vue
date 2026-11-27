<script setup lang="ts">
import { computed } from 'vue'
import { CITIES } from '../config/cities'
import type { Leg, Resort } from '../config/resorts'
import { formatHint, homeHint } from '../lib/distance'
import AppIcon from './AppIcon.vue'

/**
 * How far a resort is for me: the checked car, bus and train from Barcelona (Spanish resorts, when I live there or haven't said),
 * else my own distance from my home city, else a link to set it.
 */
const props = defineProps<{ resort: Resort; homeCity?: string | null }>()
const emit = defineEmits<{ setup: [] }>()
const checked = computed(() => Boolean(props.resort.travel) && (!props.homeCity || props.homeCity === 'barcelona'))
const mine = computed(() => {
  if (!props.homeCity || checked.value) return null
  const h = homeHint(props.homeCity, props.resort)
  return h && { from: CITIES.find((c) => c.id === props.homeCity)?.name ?? '', text: formatHint(h) }
})

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
  if (!t) return []
  return [
    { id: 'car', label: 'Car', leg: { minutes: t.car.minutes, detail: `${t.car.km} km`, route: t.car.route, estimate: false } },
    { id: 'bus', label: 'Bus', leg: leg(t.bus) },
    { id: 'train', label: 'Train', leg: leg(t.train) },
  ]
})
</script>

<template>
  <template v-if="resort.travel && checked">
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
  <p v-if="mine" class="t-mine"><AppIcon name="car" :size="14" /> <span>From {{ mine.from }}: <strong class="t-km">{{ mine.text }}</strong></span></p>
  <p v-else-if="homeCity === null" class="t-mine"><button type="button" class="link-button t-setup" @click="emit('setup')">Set where you live</button> <span>to see how far this is</span></p>
</template>
