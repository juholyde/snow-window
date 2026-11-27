<script setup lang="ts">
import { computed } from 'vue'
import type { Resort } from '../config/resorts'
import { type Day, addDays, formatWeekday, todayLocal } from '../lib/dates'
import type { Forecasts } from '../lib/weather'
import AppIcon from './AppIcon.vue'
import ResortTravel from './ResortTravel.vue'

const props = defineProps<{ forecasts: Forecasts | null; resortId: string; resorts: Resort[]; homeCity: string | null; error: boolean }>()
const emit = defineEmits<{ use: [id: string]; account: [] }>()

const base = import.meta.env.BASE_URL

const week: Day[] = Array.from({ length: 7 }, (_, i) => addDays(todayLocal(), i))

/** Resorts with the most snow in the coming week first. */
const cards = computed(() =>
  props.resorts.map((r) => {
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
        <ResortTravel :resort="c.r" :home-city="homeCity" @setup="emit('account')" />
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
