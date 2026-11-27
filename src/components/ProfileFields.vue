<script setup lang="ts">
import { computed, useId } from 'vue'
import { CITIES } from '../config/cities'
import { MAX_NAME } from '../lib/rules'
import PickMenu from './PickMenu.vue'

/** Name and emoji avatar, for the welcome card and the account dialog. */
const name = defineModel<string>('name', { required: true })
const emoji = defineModel<string>('emoji', { required: true })
/** Home city id ('' = not set). Only shown where a parent binds it. */
const city = defineModel<string>('city')
const props = defineProps<{ autofocus?: boolean; taken?: readonly { name: string; emoji: string }[] }>()
// One radio group per instance: the welcome form and the account dialog can both be mounted.
const id = useId()
const group = `avatar-${id}`
const countId = `name-count-${id}`
/** Who already uses each emoji in the crew: a hint, never a block. */
const takenBy = computed(() => new Map((props.taken ?? []).map((t) => [t.emoji, t.name] as const)))
const nearLimit = computed(() => [...name.value].length >= MAX_NAME - 6)

/** Cities grouped by country, countries in the order the list first names them. */
const cityOptions = [
  { value: '', label: 'Not set' },
  ...[...new Set(CITIES.map((c) => c.country))].flatMap((country) =>
    CITIES.filter((c) => c.country === country).map((c) => ({ value: c.id, label: c.name, hint: country })),
  ),
]
const cityLabel = computed(() => CITIES.find((c) => c.id === city.value)?.name ?? 'Not set')

const EMOJIS = ['⛷️', '🏂', '🎿', '❄️', '☃️', '🏔️', '🐧', '🦭', '🐻‍❄️', '🦊', '🐺', '🦌', '🐐', '🦅', '🧤', '🧣', '🚠', '🍫', '☕', '🫕', '🍷', '🔥', '😎', '🤘', '🐢', '🚀', '🦄', '🐙']
</script>

<template>
  <div class="add-form">
    <fieldset class="emoji-pick">
      <legend>Your avatar</legend>
      <label v-for="e in EMOJIS" :key="e" class="emoji-option" :class="{ picked: emoji === e, taken: takenBy.has(e) }" :title="takenBy.has(e) ? `Taken by ${takenBy.get(e)}` : undefined">
        <input v-model="emoji" type="radio" :name="group" :value="e" />
        {{ e }}
        <template v-if="takenBy.has(e)">
          <i class="taken-dot" aria-hidden="true" />
          <span class="visually-hidden">(taken by {{ takenBy.get(e) }})</span>
        </template>
      </label>
      <label class="emoji-custom">
        <span>or any:</span>
        <input v-model="emoji" type="text" maxlength="16" aria-label="Any emoji" />
      </label>
    </fieldset>
    <div class="add-line">
      <span class="avatar big">{{ emoji || '?' }}</span>
      <input
        v-model="name"
        class="name-input"
        type="text"
        :maxlength="MAX_NAME"
        placeholder="Your name"
        aria-label="Your name"
        autocomplete="given-name"
        :aria-describedby="countId"
        required
      />
      <span :id="countId" class="name-count" :class="{ near: nearLimit }">{{ nearLimit ? `${[...name].length}/${MAX_NAME}` : '' }}<span class="visually-hidden"> characters, up to {{ MAX_NAME }}</span></span>
    </div>
    <div v-if="city !== undefined" class="field home-pick">
      <span>Where you live <small>optional, shows how far each resort is</small></span>
      <PickMenu :options="cityOptions" :value="city" :label="cityLabel" menu-label="Where you live" @pick="(v) => (city = v)" />
    </div>
  </div>
</template>
