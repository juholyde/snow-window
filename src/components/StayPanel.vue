<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Person } from '../lib/overlap'
import { MAX_STAYS, nights, parseStays, type StayAction, stayPrompt, type Trip } from '../lib/trips'
import AppIcon from './AppIcon.vue'

/**
 * Where to stay, once a trip is on. The crew sets a budget and whether it drives,
 * copies a prompt into Claude (or any chatbot), pastes the STAY lines back,
 * votes and marks the one they booked.
 */
const props = defineProps<{ trip: Trip; people: Person[]; me: string | null; busy: boolean }>()
const emit = defineEmits<{ act: [action: StayAction] }>()

const n = computed(() => nights(props.trip))
const booked = computed(() => props.trip.stays.find((s) => s.id === props.trip.bookedStay) ?? null)
const options = computed(() =>
  [...props.trip.stays].sort((a, b) => Number(b.id === props.trip.bookedStay) - Number(a.id === props.trip.bookedStay)),
)
const room = computed(() => MAX_STAYS - props.trip.stays.length)
const nameOf = (id: string) => props.people.find((p) => p.id === id)

const budget = ref<string>('')
watch(
  () => props.trip.stayBudget,
  (b) => (budget.value = b === null ? '' : String(b)),
  { immediate: true },
)
function saveBudget() {
  const raw = budget.value.trim()
  const next = raw === '' ? null : Math.round(Number(raw))
  if (next !== null && !Number.isFinite(next)) return
  if (next === props.trip.stayBudget) return
  emit('act', { kind: 'prefs', tripId: props.trip.id, budget: next, driving: props.trip.driving })
}
function setDriving(v: boolean) {
  const next = props.trip.driving === v ? null : v
  emit('act', { kind: 'prefs', tripId: props.trip.id, budget: props.trip.stayBudget, driving: next })
}

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyPrompt() {
  await navigator.clipboard.writeText(stayPrompt(props.trip, props.people))
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2500)
}

const pasting = ref(false)
const pasted = ref('')
const pasteError = ref<string | null>(null)
function addPasted() {
  try {
    const stays = parseStays(pasted.value).slice(0, room.value)
    pasteError.value = null
    emit('act', { kind: 'add', tripId: props.trip.id, stays })
    pasted.value = ''
    pasting.value = false
  } catch (e) {
    pasteError.value = (e as Error).message
  }
}
</script>

<template>
  <section class="stay-panel" :aria-labelledby="`stay-${trip.id}`">
    <header class="stay-head">
      <h3 :id="`stay-${trip.id}`" tabindex="-1">Where to stay</h3>
      <span class="stay-booked" v-if="booked"><AppIcon name="check" :size="14" /> Booked: {{ booked.name }}</span>
      <span v-else class="muted-note">{{ n }} {{ n === 1 ? 'night' : 'nights' }} · pick a place together</span>
    </header>

    <div class="stay-prefs">
      <label class="budget">
        <span>Budget</span>
        <span class="budget-box">
          €<input
            v-model="budget"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="4"
            placeholder="–"
            aria-label="Budget in euros per person per night"
            @blur="saveBudget"
            @keydown.enter.prevent="saveBudget"
          /><small>/ night each</small>
        </span>
      </label>
      <fieldset class="drive-toggle">
        <legend class="visually-hidden">Getting there</legend>
        <button type="button" :aria-pressed="trip.driving === true" :disabled="busy" @click="setDriving(true)">
          <AppIcon name="car" :size="15" /> Driving
        </button>
        <button type="button" :aria-pressed="trip.driving === false" :disabled="busy" @click="setDriving(false)">
          <AppIcon name="bus" :size="15" /> No car
        </button>
      </fieldset>
    </div>

    <ul v-if="options.length" class="stay-options">
      <li v-for="s in options" :key="s.id" :class="{ booked: s.id === trip.bookedStay, faded: booked && s.id !== trip.bookedStay }">
        <div class="stay-main">
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer nofollow" class="stay-name">
            {{ s.name }} <AppIcon name="external" :size="13" />
          </a>
          <strong v-else class="stay-name">{{ s.name }}</strong>
          <span v-if="s.price !== null" class="stay-price">
            €{{ s.price }}/night · <strong>€{{ Math.round(s.price * n) }}</strong> each
          </span>
          <p v-if="s.why" class="stay-why">{{ s.why }}</p>
        </div>
        <div class="stay-acts">
          <button
            type="button"
            class="vote"
            :aria-pressed="me !== null && s.votes.includes(me)"
            :disabled="busy || !me"
            :title="s.votes.map((v) => nameOf(v)?.name ?? 'someone').join(', ') || 'No votes yet'"
            @click="emit('act', { kind: 'vote', stayId: s.id, vote: !(me && s.votes.includes(me)) })"
          >
            <AppIcon name="heart" :size="14" /> {{ s.votes.length }}
            <span class="vote-faces"><span v-for="v in s.votes" :key="v">{{ nameOf(v)?.emoji }}</span></span>
          </button>
          <button
            v-if="s.id !== trip.bookedStay"
            type="button"
            class="ghost small-btn"
            data-book
            :disabled="busy"
            @click="emit('act', { kind: 'book', tripId: trip.id, stayId: s.id })"
          >
            Booked it
          </button>
          <button v-else type="button" class="ghost small-btn" data-book :disabled="busy" @click="emit('act', { kind: 'book', tripId: trip.id, stayId: null })">
            Not booked
          </button>
          <button
            v-if="me && (me === s.addedBy || me === trip.proposerId)"
            type="button"
            class="ghost icon-only small-btn"
            :aria-label="`Remove ${s.name}`"
            :disabled="busy"
            @click="emit('act', { kind: 'remove', stayId: s.id })"
          >
            <AppIcon name="close" :size="14" />
          </button>
        </div>
      </li>
    </ul>

    <div v-if="room > 0 && !booked" class="stay-ai">
      <p class="muted-note">
        Ask Claude or any chatbot for places: copy the prompt, paste it there, then paste the answer back here.
      </p>
      <div class="stay-ai-buttons">
        <button type="button" class="primary small-btn" @click="copyPrompt">
          <AppIcon :name="copied ? 'check' : 'copy'" :size="15" /> {{ copied ? 'Prompt copied' : 'Copy prompt' }}
        </button>
        <button type="button" class="ghost small-btn" :aria-expanded="pasting" @click="pasting = !pasting">
          <AppIcon name="paste" :size="15" /> Paste answer
        </button>
      </div>
      <form v-if="pasting" class="stay-paste" @submit.prevent="addPasted">
        <textarea
          v-model="pasted"
          rows="4"
          aria-label="The chatbot's answer"
          placeholder="STAY | Hotel Tuca | https://… | 60 | Ski-in, ski-out"
        />
        <p v-if="pasteError" class="paste-error" role="alert">{{ pasteError }}</p>
        <p v-else class="muted-note">Lines that start with STAY become options; the rest is ignored. You can type one yourself too.</p>
        <button type="submit" class="primary small-btn" :disabled="busy || !pasted.trim()">Add places</button>
      </form>
    </div>
  </section>
</template>
