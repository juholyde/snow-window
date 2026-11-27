<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Person } from '../lib/overlap'
import { type CarAction, MAX_CAR_NOTE, MAX_SEATS, type Trip } from '../lib/trips'
import AppIcon from './AppIcon.vue'

/** Who drives, once a trip is on: members offer a car with N free seats; the others take or leave one. */
const props = defineProps<{ trip: Trip; people: Person[]; me: string | null; busy: boolean }>()
const emit = defineEmits<{ act: [action: CarAction] }>()

const who = (id: string) => props.people.find((p) => p.id === id)
const myCar = computed(() => props.trip.cars.find((c) => c.driverId === props.me) ?? null)
const mySeat = computed(() => props.trip.cars.find((c) => props.me && c.riders.includes(props.me)) ?? null)

const offering = ref(false)
const seats = ref(3)
const note = ref('')
const step = (by: number) => (seats.value = Math.min(MAX_SEATS, Math.max(1, seats.value + by)))
function offer() {
  emit('act', { kind: 'offer', tripId: props.trip.id, seats: seats.value, note: note.value })
  offering.value = false
  note.value = ''
}
</script>

<template>
  <section class="car-panel" :aria-labelledby="`cars-${trip.id}`">
    <header class="stay-head">
      <h3 :id="`cars-${trip.id}`" tabindex="-1">Cars</h3>
      <span class="muted-note">{{ trip.cars.length ? 'Take a seat, or offer yours' : 'Who is driving?' }}</span>
    </header>

    <ul v-if="trip.cars.length" class="car-list">
      <li v-for="c in trip.cars" :key="c.id" :data-car="c.id">
        <div class="car-main">
          <strong>{{ who(c.driverId)?.emoji }} {{ c.driverId === me ? 'You drive' : `${who(c.driverId)?.name ?? 'Someone who left'} drives` }}</strong>
          <span v-if="c.note" class="stay-why">{{ c.note }}</span>
          <span class="car-seats">
            <span class="seat-dots" aria-hidden="true">
              <span v-for="r in c.riders" :key="r" class="seat taken" :title="who(r)?.name">{{ who(r)?.emoji }}</span>
              <span v-for="i in c.seats - c.riders.length" :key="`free-${i}`" class="seat" />
            </span>
            <span class="muted-note">
              {{ c.seats - c.riders.length }} of {{ c.seats }} {{ c.seats === 1 ? 'seat' : 'seats' }} free<template v-if="c.riders.length">
                · {{ c.riders.map((r) => who(r)?.name ?? 'someone').join(', ') }}</template>
            </span>
          </span>
        </div>
        <div class="stay-acts">
          <button
            v-if="me && c.riders.includes(me)"
            type="button"
            class="ghost small-btn"
            :aria-label="`Leave ${who(c.driverId)?.name ?? 'the'} car`"
            :disabled="busy"
            @click="emit('act', { kind: 'leave', carId: c.id })"
          >
            Leave seat
          </button>
          <button
            v-else-if="me && !myCar"
            type="button"
            class="primary small-btn"
            :aria-label="`${mySeat ? 'Move to' : 'Take a seat in'} ${who(c.driverId)?.name ?? 'the'} car`"
            :disabled="busy || c.riders.length >= c.seats"
            @click="emit('act', { kind: 'claim', carId: c.id })"
          >
            {{ c.riders.length >= c.seats ? 'Full' : mySeat ? 'Move here' : 'Take a seat' }}
          </button>
          <button
            v-if="me && (me === c.driverId || me === trip.proposerId)"
            type="button"
            class="ghost icon-only small-btn"
            :aria-label="`Remove ${who(c.driverId)?.name ?? 'the'} car`"
            :disabled="busy"
            @click="emit('act', { kind: 'remove', carId: c.id })"
          >
            <AppIcon name="close" :size="14" />
          </button>
        </div>
      </li>
    </ul>

    <button v-if="me && !myCar && !offering" type="button" class="ghost small-btn car-offer" :aria-expanded="false" @click="offering = true">
      <AppIcon name="car" :size="15" /> I'm driving
    </button>
    <form v-if="offering" class="car-form" @submit.prevent="offer">
      <fieldset class="stepper">
        <legend class="visually-hidden">Free passenger seats</legend>
        <button type="button" class="ghost" aria-label="One seat fewer" :disabled="seats <= 1" @click="step(-1)">−</button>
        <output aria-live="polite">{{ seats }} {{ seats === 1 ? 'seat' : 'seats' }}</output>
        <button type="button" class="ghost" aria-label="One seat more" :disabled="seats >= MAX_SEATS" @click="step(1)">+</button>
      </fieldset>
      <input v-model="note" :maxlength="MAX_CAR_NOTE" aria-label="Note for the car (optional)" placeholder="Leaves Barcelona 7am (optional)" />
      <div class="car-form-buttons">
        <button type="submit" class="primary small-btn" :disabled="busy">Offer car</button>
        <button type="button" class="ghost small-btn" @click="offering = false">Cancel</button>
      </div>
    </form>
  </section>
</template>
