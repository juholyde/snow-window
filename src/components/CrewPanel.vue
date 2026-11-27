<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Person } from '../lib/overlap'
import { AREAS, type Area } from '../config/resorts'
import { MAX_CREW_NAME, MAX_PEOPLE } from '../lib/rules'
import type { Crew } from '../lib/store'
import AppIcon from './AppIcon.vue'

/** The current crew in the crew sheet: who's in, the invite link, and the owner's controls. */
const props = defineProps<{ crew: Crew; people: Person[]; me: string; busy: boolean }>()
const emit = defineEmits<{
  rename: [name: string]
  regions: [regions: Area[]]
  copy: []
  reset: []
  remove: [person: Person]
  leave: []
}>()

const owner = computed(() => props.crew.ownerId === props.me)
const renaming = ref(false)
const draft = ref('')
function startRename() {
  draft.value = props.crew.name
  renaming.value = true
}
/** Any member can change them; the last area left on can't be turned off. */
const onlyOne = (a: Area) => props.crew.regions.length === 1 && props.crew.regions.includes(a)
function toggleArea(a: Area, on: boolean) {
  const next = on ? [...props.crew.regions, a] : props.crew.regions.filter((r) => r !== a)
  if (next.length) emit('regions', next)
}
function saveName() {
  if (draft.value.trim() && draft.value.trim() !== props.crew.name) emit('rename', draft.value)
  renaming.value = false
}
</script>

<template>
  <section class="crew-panel" aria-labelledby="crew-title">
    <div class="crew-head">
      <form v-if="renaming" class="crew-rename" @submit.prevent="saveName">
        <input v-model="draft" type="text" :maxlength="MAX_CREW_NAME" aria-label="Crew name" required />
        <button type="submit" class="primary small">Save</button>
        <button type="button" class="ghost small" @click="renaming = false">Cancel</button>
      </form>
      <template v-else>
        <h2 id="crew-title">{{ crew.name }}</h2>
        <button v-if="owner" type="button" class="ghost small" @click="startRename">Rename</button>
      </template>
    </div>

    <ul class="crew-list">
      <li v-for="p in people" :key="p.id">
        <span class="avatar">{{ p.emoji }}</span>
        <span class="crew-name">{{ p.name }}<small v-if="p.id === me"> (you)</small></span>
        <small v-if="p.id === crew.ownerId" class="crew-role">started it</small>
        <button
          v-if="owner && p.id !== me"
          type="button"
          class="ghost icon-only"
          :aria-label="`Remove ${p.name} from the crew`"
          :disabled="busy"
          @click="emit('remove', p)"
        >
          <AppIcon name="close" />
        </button>
      </li>
    </ul>

    <fieldset class="crew-regions" :disabled="busy">
      <legend>Where you ski <small>resorts shown to this crew</small></legend>
      <div class="chips">
        <label v-for="a in AREAS" :key="a.id" class="chip" :class="{ on: crew.regions.includes(a.id) }">
          <input type="checkbox" :checked="crew.regions.includes(a.id)" :disabled="onlyOne(a.id)" @change="toggleArea(a.id, ($event.target as HTMLInputElement).checked)" />
          {{ a.label }}
        </label>
      </div>
    </fieldset>

    <div class="crew-invite">
      <button type="button" class="primary" :disabled="people.length >= MAX_PEOPLE" @click="emit('copy')">
        Copy invite link
      </button>
      <p class="muted-note">
        {{ people.length >= MAX_PEOPLE ? `The crew is full (${MAX_PEOPLE} people).` : 'Anyone with the link can join this crew.' }}
        <button v-if="owner" type="button" class="link-button" :disabled="busy" @click="emit('reset')">Make a new link</button>
      </p>
    </div>

    <button type="button" class="ghost danger" :disabled="busy" @click="emit('leave')">Leave crew</button>
  </section>
</template>
