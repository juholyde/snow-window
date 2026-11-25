<script setup lang="ts">
import { MAX_NAME } from '../lib/rules'

/** Name and emoji avatar, for the welcome card and the account dialog. */
const name = defineModel<string>('name', { required: true })
const emoji = defineModel<string>('emoji', { required: true })
defineProps<{ autofocus?: boolean }>()

const EMOJIS = ['⛷️', '🏂', '🎿', '❄️', '☃️', '🏔️', '🐧', '🦭', '🐻‍❄️', '🦊', '🐺', '🦌', '🐐', '🦅', '🧤', '🧣', '🚠', '🍫', '☕', '🫕', '🍷', '🔥', '😎', '🤘', '🐢', '🚀', '🦄', '🐙']
</script>

<template>
  <div class="add-form">
    <fieldset class="emoji-pick">
      <legend>Your avatar</legend>
      <label v-for="e in EMOJIS" :key="e" class="emoji-option" :class="{ picked: emoji === e }">
        <input v-model="emoji" type="radio" :value="e" />
        {{ e }}
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
        required
      />
    </div>
  </div>
</template>
