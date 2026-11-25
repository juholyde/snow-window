<script setup lang="ts">
import { computed, ref } from 'vue'
import { type Day, formatMonth, todayLocal } from '../lib/dates'
import { type DayMark, markDay, type Person } from '../lib/overlap'
import { modeFor, type PaintMode, paint } from '../lib/selection'

const props = defineProps<{
  days: Day[]
  people: Person[]
  editable: Set<string>
  counts: Map<Day, number>
  focused: Day | null
  highlight: { start: Day; end: Day } | null
}>()

const emit = defineEmits<{
  change: [id: string, days: Day[]]
  focus: [day: Day]
  manage: [id: string]
}>()

const today = todayLocal()
const marks = computed(() => new Map(props.days.map((d) => [d, markDay(d)] as const)))
const markOf = (d: Day): DayMark => marks.value.get(d) ?? { weekend: false }

const months = computed(() => {
  const out: { label: string; span: number }[] = []
  for (const d of props.days) {
    const label = formatMonth(d)
    const last = out[out.length - 1]
    if (last?.label === label) last.span++
    else out.push({ label, span: 1 })
  }
  return out
})

const weekLetter = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const dayNum = (d: Day) => Number(d.slice(8))
const letter = (d: Day) => weekLetter[new Date(`${d}T00:00:00Z`).getUTCDay()]

function columnClass(d: Day) {
  const m = markOf(d)
  return {
    weekend: m.weekend,
    holiday: Boolean(m.holiday),
    keydate: Boolean(m.keyDate),
    today: d === today,
    focused: d === props.focused,
    lit: props.highlight !== null && d >= props.highlight.start && d <= props.highlight.end,
  }
}

// People who have not marked any day yet do not count against "everyone".
const total = computed(() => props.people.filter((p) => p.days.length).length)
function heat(d: Day): string {
  const n = props.counts.get(d) ?? 0
  if (!n || !total.value) return ''
  if (n === total.value && total.value > 1) return 'all'
  return `h${Math.min(4, Math.ceil((n / total.value) * 4))}`
}

// Dragging across your own row fills or clears every day it passes.
type Drag = { id: string; anchor: Day; current: Day; mode: PaintMode; pointer: number }
const drag = ref<Drag | null>(null)

function shownDays(p: Person): Set<Day> {
  const d = drag.value
  return new Set(d && d.id === p.id ? paint(p.days, d.anchor, d.current, d.mode) : p.days)
}

function dayAt(e: PointerEvent): Day | null {
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-day]')
  return (el?.dataset.day as Day | undefined) ?? null
}

function onDown(e: PointerEvent, p: Person, d: Day) {
  if (!props.editable.has(p.id) || e.button !== 0) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  drag.value = { id: p.id, anchor: d, current: d, mode: modeFor(p.days, d), pointer: e.pointerId }
}

function onMove(e: PointerEvent) {
  const d = drag.value
  if (!d || e.pointerId !== d.pointer) return
  const day = dayAt(e)
  if (day) d.current = day
}

function onUp(e: PointerEvent) {
  const d = drag.value
  if (!d || e.pointerId !== d.pointer) return
  drag.value = null
  const person = props.people.find((p) => p.id === d.id)
  if (!person) return
  const next = paint(person.days, d.anchor, d.current, d.mode)
  if (next.join() !== person.days.join()) emit('change', d.id, next)
}

const scroller = ref<HTMLElement | null>(null)
function scrollToDay(day: Day, smooth = true) {
  const el = scroller.value?.querySelector<HTMLElement>(`.head-days [data-day="${day}"]`)
  const box = scroller.value
  if (!el || !box) return
  const nameCol = box.querySelector<HTMLElement>('.name')?.offsetWidth ?? 0
  const left = box.scrollLeft + el.getBoundingClientRect().left - box.getBoundingClientRect().left
  box.scrollTo({ left: Math.max(0, left - nameCol - 3 * el.offsetWidth), behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" })
}
defineExpose({ scrollToDay })
</script>

<template>
  <div
    ref="scroller"
    class="timeline"
    :style="{ '--cols': days.length }"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <div class="grid">
      <!-- Months -->
      <div class="name head corner" />
      <div class="head-months">
        <div v-for="m in months" :key="m.label" class="month" :style="{ gridColumn: `span ${m.span}` }">
          <span>{{ m.label }}</span>
        </div>
      </div>

      <!-- Days -->
      <div class="name head corner corner-low">
        <span class="hint">Tap a day for details</span>
      </div>
      <div class="head-days">
        <button
          v-for="d in days"
          :key="d"
          type="button"
          class="day-head"
          :class="columnClass(d)"
          :data-day="d"
          :title="[markOf(d).holiday, markOf(d).keyDate].filter(Boolean).join(' · ') || undefined"
          @click="emit('focus', d)"
        >
          <span class="letter">{{ letter(d) }}</span>
          <span class="num">{{ dayNum(d) }}</span>
          <span v-if="markOf(d).holiday" class="flag holiday-flag" aria-hidden="true" />
          <span v-else-if="markOf(d).keyDate" class="flag key-flag" aria-hidden="true" />
        </button>
      </div>

      <!-- Overlap -->
      <div class="name overlap-name">
        <span class="avatar">🏔️</span>
        <span class="label">
          <strong>Whole crew</strong>
          <small>{{ total }}/{{ people.length }} marked</small>
        </span>
      </div>
      <div class="row overlap-row">
        <button
          v-for="d in days"
          :key="d"
          type="button"
          class="cell overlap-cell"
          :class="[columnClass(d), heat(d)]"
          :data-day="d"
          :aria-label="`${d}: ${counts.get(d) ?? 0} of ${total} free`"
          @click="emit('focus', d)"
        >
          <span v-if="heat(d) === 'all'">✓</span>
          <span v-else-if="counts.get(d)">{{ counts.get(d) }}</span>
        </button>
      </div>

      <!-- People -->
      <template v-for="p in people" :key="p.id">
        <div class="name person-name" :class="{ mine: editable.has(p.id) }">
          <span class="avatar">{{ p.emoji }}</span>
          <span class="label">
            <strong>{{ p.name }}</strong>
            <small v-if="editable.has(p.id)">you · {{ p.days.length }} days</small>
            <small v-else>{{ p.days.length }} days</small>
          </span>
          <button
            v-if="editable.has(p.id)"
            type="button"
            class="manage"
            :aria-label="`Options for ${p.name}`"
            @click="emit('manage', p.id)"
          >
            ⋯
          </button>
        </div>
        <div class="row" :class="{ editable: editable.has(p.id) }">
          <div
            v-for="d in days"
            :key="d"
            class="cell"
            :class="[columnClass(d), { free: shownDays(p).has(d) }]"
            :data-day="d"
            @pointerdown="onDown($event, p, d)"
          />
        </div>
      </template>
      <slot name="footer" />
    </div>
  </div>
</template>
