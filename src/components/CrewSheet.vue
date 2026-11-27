<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Area } from '../config/resorts'
import type { Person } from '../lib/overlap'
import type { Crew } from '../lib/store'
import AppIcon from './AppIcon.vue'
import CrewPanel from './CrewPanel.vue'

/** Side sheet from the header: switch crews, start one, and the current crew's members and settings. */
const props = defineProps<{
  open: boolean
  crews: Crew[]
  crew: Crew
  people: Person[]
  me: string
  guest: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  close: []
  select: [crewId: string]
  create: []
  account: []
  rename: [name: string]
  regions: [regions: Area[]]
  copy: []
  reset: []
  remove: [person: Person]
  leave: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
watch(
  () => props.open,
  (open) => (open ? dialog.value?.showModal() : dialog.value?.close()),
)
// A tap on the backdrop (outside the sheet's box) closes it.
function onClick(e: MouseEvent) {
  if (e.target === dialog.value) emit('close')
}
</script>

<template>
  <!-- biome-ignore lint/a11y/useKeyWithClickEvents: backdrop tap only; Escape closes the dialog natively -->
  <dialog ref="dialog" class="sheet" aria-labelledby="sheet-title" @close="emit('close')" @click="onClick">
    <div class="sheet-body">
      <div class="sheet-head">
        <h2 id="sheet-title">Your crews</h2>
        <button type="button" class="ghost icon-only" aria-label="Close" @click="emit('close')"><AppIcon name="close" /></button>
      </div>

      <ul class="crew-picker">
        <li v-for="c in crews" :key="c.id">
          <button type="button" :aria-current="c.id === crew.id" @click="emit('select', c.id)">
            <span class="crew-picker-name">{{ c.name }}</span>
            <small>{{ c.members }} {{ c.members === 1 ? 'person' : 'people' }}</small>
            <AppIcon v-if="c.id === crew.id" name="check" />
          </button>
        </li>
        <li>
          <button type="button" class="crew-picker-new" @click="emit('create')"><AppIcon name="plus" /> New crew</button>
        </li>
      </ul>

      <CrewPanel
        :crew="crew"
        :people="people"
        :me="me"
        :busy="busy"
        @rename="(n) => emit('rename', n)"
        @regions="(r) => emit('regions', r)"
        @copy="emit('copy')"
        @reset="emit('reset')"
        @remove="(p) => emit('remove', p)"
        @leave="emit('leave')"
      />

      <p v-if="guest" class="guest-note">
        You're a guest on this device.
        <button type="button" class="link-button" @click="emit('account')">Save your account</button>
        to keep your crews.
      </p>
    </div>
  </dialog>
</template>
