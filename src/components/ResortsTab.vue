<script setup lang="ts">
import { computed } from 'vue'
import { RESORTS, type Resort } from '../config/resorts'
import { type Day, addDays, formatWeekday, todayLocal } from '../lib/dates'
import type { Forecasts } from '../lib/weather'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ forecasts: Forecasts | null; resortId: string; error: boolean }>()
const emit = defineEmits<{ use: [id: string] }>()

const base = import.meta.env.BASE_URL

const hm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
type Mode = {
  id: 'car' | 'bus' | 'train'
  label: string
  leg: { minutes: number; detail: string; route: string; estimate: boolean; runs?: string } | null
}
function modes(r: Resort): Mode[] {
  const t = r.travel
  const leg = (l: Resort['travel']['bus']) =>
    l && {
      minutes: l.minutes,
      detail: l.runs ? 'seasonal' : l.kind === 'direct' ? 'direct' : 'change',
      route: l.runs ? `${l.route}. Runs ${l.runs}` : l.route,
      estimate: l.checked === 'estimate',
      runs: l.runs,
    }
  return [
    { id: 'car', label: 'Car', leg: { minutes: t.car.minutes, detail: `${t.car.km} km`, route: t.car.route, estimate: false } },
    { id: 'bus', label: 'Bus', leg: leg(t.bus) },
    { id: 'train', label: 'Train', leg: leg(t.train) },
  ]
}
const week: Day[] = Array.from({ length: 7 }, (_, i) => addDays(todayLocal(), i))

/** Resorts with the most snow in the coming week first. */
const cards = computed(() =>
  RESORTS.map((r) => {
    const days = week.map((d) => ({ day: d, w: props.forecasts?.[r.id]?.[d] ?? null }))
    const snow = days.reduce((sum, x) => sum + (x.w?.snowCm ?? 0), 0)
    return { r, days, snow }
  }).sort((a, b) => b.snow - a.snow),
)
</script>

<template>
  <div class="resorts">
    <h2 class="visually-hidden">Resorts</h2>
    <p v-if="error" class="fc-error">Couldn't reach the weather service. Webcams still work.</p>
    <ul class="resort-grid">
      <li v-for="c in cards" :key="c.r.id" class="resort" :class="{ picked: c.r.id === resortId }">
        <figure class="resort-photo">
          <img :src="base + c.r.photo.file" :alt="`${c.r.name} in winter`" loading="lazy" width="960" height="720" />
          <figcaption>
            <a :href="c.r.photo.source" target="_blank" rel="noopener">{{ c.r.photo.author }} · {{ c.r.photo.license }}</a>
          </figcaption>
        </figure>
        <header class="resort-head">
          <div>
            <h3>{{ c.r.name }}</h3>
            <small>{{ c.r.region }} · {{ c.r.elevation }} m</small>
          </div>
          <span class="week-snow" :class="{ fresh: c.snow >= 10 }">
            <span><strong>{{ c.snow }}</strong> cm</span>
            <small>next 7 days</small>
          </span>
        </header>
        <ul class="travel" :aria-label="`Getting to ${c.r.name} from Barcelona`">
          <li
            v-for="m in modes(c.r)"
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
        <p v-if="c.r.travel.note" class="t-note">{{ c.r.travel.note }}</p>
        <ol class="week">
          <li v-for="x in c.days" :key="x.day" :class="{ fresh: (x.w?.snowCm ?? 0) >= 5 }">
            <span class="wd">{{ formatWeekday(x.day).slice(0, 2) }}</span>
            <template v-if="x.w">
              <AppIcon :name="x.w.kind" :size="18" />
              <span class="v">{{ x.w.snowCm ? `${x.w.snowCm}cm` : `${x.w.tMax}°` }}</span>
            </template>
            <span v-else class="v">–</span>
          </li>
        </ol>
        <div class="resort-actions">
          <a
            v-for="(cam, i) in c.r.webcams"
            :key="cam.url"
            :href="cam.url"
            target="_blank"
            rel="noopener"
            :class="i === 0 ? 'cam primary-link' : 'cam'"
          >{{ cam.label }} <AppIcon name="external" :size="14" /></a>
          <button
            type="button"
            class="ghost use"
            :aria-pressed="c.r.id === resortId"
            @click="emit('use', c.r.id)"
          >
            {{ c.r.id === resortId ? 'On the board' : 'Show on board' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
