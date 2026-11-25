<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { MAX_NAME } from '../lib/rules'
import AppIcon from './AppIcon.vue'

defineProps<{ full: boolean; busy: boolean }>()
const emit = defineEmits<{ add: [name: string, emoji: string] }>()

const EMOJIS = ['⛷️', '🏂', '🎿', '❄️', '☃️', '🏔️', '🐧', '🦭', '🐻‍❄️', '🦊', '🐺', '🦌', '🐐', '🦅', '🧤', '🧣', '🚠', '🍫', '☕', '🫕', '🍷', '🔥', '😎', '🤘', '🐢', '🚀', '🦄', '🐙']

const open = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)

async function start() {
  open.value = true
  await nextTick()
  nameInput.value?.focus()
}
const name = ref('')
const emoji = ref('⛷️')

function submit() {
  if (!name.value.trim()) return
  emit('add', name.value, emoji.value)
  name.value = ''
  open.value = false
}
</script>

<template>
  <div class="add">
    <p v-if="full" class="add-full">The board has 20 people, its limit for now.</p>
    <button v-else-if="!open" type="button" class="add-open" @click="start">
      <AppIcon name="plus" /> Add yourself
    </button>
    <form v-else class="add-form" @submit.prevent="submit">
      <fieldset class="emoji-pick">
        <legend>Your avatar</legend>
        <label v-for="e in EMOJIS" :key="e" class="emoji-option" :class="{ picked: emoji === e }">
          <input v-model="emoji" type="radio" name="emoji" :value="e" />
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
          ref="nameInput"
          v-model="name"
          class="name-input"
          type="text"
          :maxlength="MAX_NAME"
          placeholder="Your name"
          aria-label="Your name"
        />
        <button type="submit" class="primary" :disabled="busy || !name.trim() || !emoji.trim()">Add row</button>
        <button type="button" class="ghost" @click="open = false">Cancel</button>
      </div>
    </form>
  </div>
</template>
