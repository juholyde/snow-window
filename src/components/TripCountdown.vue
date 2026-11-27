<script setup lang="ts">
import { computed } from 'vue'
import { RESORTS } from '../config/resorts'
import { countdownText, nextOnTrip, powderDays } from '../lib/countdown'
import { type Day, todayLocal } from '../lib/dates'
import type { Trip } from '../lib/trips'
import type { Forecasts } from '../lib/weather'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ trips: readonly Trip[]; forecasts: Forecasts | null }>()

const today = computed<Day>(() => todayLocal())
const trip = computed(() => nextOnTrip(props.trips, today.value))
const text = computed(() => (trip.value ? countdownText(trip.value, today.value) : null))
const resort = computed(() => RESORTS.find((r) => r.id === trip.value?.resortId))
const days = computed(() => (trip.value ? powderDays(trip.value, props.forecasts?.[trip.value.resortId] ?? null, today.value) : []))
</script>

<template>
  <div v-if="trip && text" class="countdown" role="status">
    <div class="countdown-head">
      <strong>{{ text }}</strong>
      <span>{{ resort?.name ?? 'Your trip' }}</span>
    </div>
    <ul v-if="days.length" class="powder" aria-label="Forecast snowfall per trip day">
      <li v-for="d in days" :key="d.day" :class="{ fresh: d.fresh }">
        <AppIcon name="snow" :size="12" /> {{ d.label }} <strong>{{ d.cm }} cm</strong>
      </li>
    </ul>
  </div>
</template>
