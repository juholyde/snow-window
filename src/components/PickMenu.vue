<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'
import AppIcon from './AppIcon.vue'

/**
 * A compact menu button in place of a native <select>: opens a list in the top layer
 * (popover, so it isn't clipped by the scrolling timeline), arrows move, Enter picks, Esc closes.
 */
export type PickOption = { value: string; label: string; hint?: string }
const props = defineProps<{ options: PickOption[]; value: string | null; label: string; menuLabel: string }>()
const emit = defineEmits<{ pick: [value: string] }>()

const id = useId()
const button = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)
const open = ref(false)

function place() {
  const b = button.value?.getBoundingClientRect()
  const l = list.value
  if (!b || !l) return
  const below = innerHeight - b.bottom
  const height = Math.min(l.scrollHeight, 320)
  l.style.left = `${Math.max(8, Math.min(b.left, innerWidth - l.offsetWidth - 8))}px`
  l.style.top = below >= height + 8 || below > b.top ? `${b.bottom + 4}px` : `${Math.max(8, b.top - height - 4)}px`
  l.style.minWidth = `${b.width}px`
}
async function onToggle(e: Event) {
  open.value = (e as ToggleEvent).newState === 'open'
  if (!open.value) return
  place()
  await nextTick()
  const items = [...(list.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  ;(items.find((b) => b.dataset.value === props.value) ?? items[0])?.focus()
}
function pick(v: string) {
  list.value?.hidePopover()
  button.value?.focus()
  emit('pick', v)
}
function onKey(e: KeyboardEvent) {
  const items = [...(list.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  const i = items.indexOf(document.activeElement as HTMLButtonElement)
  const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : step ? (i + step + items.length) % items.length : -1
  if (to < 0) return
  e.preventDefault()
  items[to]?.focus()
}
</script>

<template>
  <button
    ref="button"
    type="button"
    class="pick-button"
    :popovertarget="id"
    aria-haspopup="listbox"
    :aria-expanded="open"
    :aria-label="`${menuLabel}: ${label}`"
  >
    <span class="pick-label">{{ label }}</span>
    <AppIcon name="chevron" :size="14" />
  </button>
  <div :id="id" ref="list" popover="auto" class="pick-list" role="listbox" :aria-label="menuLabel" @toggle="onToggle" @keydown="onKey">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="option"
      :data-value="o.value"
      :aria-selected="o.value === value"
      @click="pick(o.value)"
    >
      <span>{{ o.label }}</span>
      <small v-if="o.hint">{{ o.hint }}</small>
      <AppIcon v-if="o.value === value" name="check" :size="14" />
    </button>
  </div>
</template>
