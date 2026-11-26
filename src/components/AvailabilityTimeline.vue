<script setup lang="ts">
import { computed, ref } from 'vue'
import { type Day, daysBetween, formatLong, formatMonth, todayLocal } from '../lib/dates'
import { type DayMark, markDay, type Person } from '../lib/overlap'
import { modeFor, type PaintMode, paint, type Range, span, tapRange } from '../lib/selection'
import { MAX_TRIP_DAYS } from '../lib/trips'
import { RESORTS } from '../config/resorts'
import type { DayWeather } from '../lib/weather'
import AppIcon from './AppIcon.vue'
import PickMenu from './PickMenu.vue'

const props = defineProps<{
  days: Day[]
  people: Person[]
  editable: Set<string>
  counts: Map<Day, number>
  focused: Day | null
  highlight: { start: Day; end: Day } | null
  resortId: string
  forecast: Record<Day, DayWeather> | null
  /** 'pick' turns taps and drags into picking a date range (trip suggestions) instead of marking days. */
  mode?: 'paint' | 'pick'
}>()

const emit = defineEmits<{
  change: [id: string, days: Day[]]
  focus: [day: Day]
  manage: [id: string]
  resort: [id: string]
  pick: [range: Range]
}>()
const picking = computed(() => props.mode === 'pick')
const focus = (d: Day) => {
  if (!picking.value) emit('focus', d)
}

const today = todayLocal()
const marks = computed(() => new Map(props.days.map((d) => [d, markDay(d)] as const)))
const markOf = (d: Day): DayMark => marks.value.get(d) ?? { weekend: false }

const months = computed(() => {
  const out: { label: string; span: number; start: Day }[] = []
  for (const d of props.days) {
    const label = formatMonth(d)
    const last = out[out.length - 1]
    if (last?.label === label) last.span++
    else out.push({ label, span: 1, start: d })
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
    lit: lit.value !== null && d >= lit.value.start && d <= lit.value.end,
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

// Picking: a mouse drags a range; a finger taps the first day, then the last (so swiping still scrolls).
type Pick = { anchor: Day; current: Day; pointer: number; touch: boolean }
const pickDrag = ref<Pick | null>(null)
const lit = computed<Range | null>(() => {
  const p = pickDrag.value
  return p && !p.touch && p.anchor !== p.current ? span(p.anchor, p.current, MAX_TRIP_DAYS) : props.highlight
})

const pickLabel = computed(() => {
  const r = lit.value
  if (!r) return 'Tap first day, then last'
  const n = daysBetween(r.start, r.end)
  return n === 0 ? '1 day' : `${n} ${n === 1 ? 'night' : 'nights'}`
})
function slotClass(d: Day) {
  const r = lit.value
  const picked = r !== null && d >= r.start && d <= r.end
  return {
    option: (props.counts.get(d) ?? 0) > 0,
    best: heat(d) === 'all',
    picked,
    pstart: picked && d === r?.start,
    pend: picked && d === r?.end,
  }
}

function onPickDown(e: PointerEvent) {
  if (!picking.value || e.button !== 0) return
  const day = dayAt(e)
  if (!day) return
  const touch = e.pointerType === 'touch'
  if (!touch) e.preventDefault()
  pickDrag.value = { anchor: day, current: day, pointer: e.pointerId, touch }
}

function onPickUp(e: PointerEvent) {
  const p = pickDrag.value
  if (!p || e.pointerId !== p.pointer) return
  pickDrag.value = null
  if (e.type === 'pointercancel') return
  const day = dayAt(e)
  if (p.touch || p.anchor === p.current) {
    if (day === p.anchor) emit('pick', tapRange(props.highlight, day, MAX_TRIP_DAYS))
  } else emit('pick', span(p.anchor, p.current, MAX_TRIP_DAYS))
}

function onDown(e: PointerEvent, p: Person, d: Day) {
  if (picking.value || !props.editable.has(p.id) || e.button !== 0) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  drag.value = { id: p.id, anchor: d, current: d, mode: modeFor(p.days, d), pointer: e.pointerId }
}

function onMove(e: PointerEvent) {
  const p = pickDrag.value
  if (p && !p.touch && e.pointerId === p.pointer) {
    const day = dayAt(e)
    if (day) p.current = day
  }
  const d = drag.value
  if (!d || e.pointerId !== d.pointer) return
  const day = dayAt(e)
  if (day) d.current = day
}

function onUp(e: PointerEvent) {
  onPickUp(e)
  const d = drag.value
  if (!d || e.pointerId !== d.pointer) return
  drag.value = null
  const person = props.people.find((p) => p.id === d.id)
  if (!person) return
  const next = paint(person.days, d.anchor, d.current, d.mode)
  if (next.join() !== person.days.join()) emit('change', d.id, next)
}

const scroller = ref<HTMLElement | null>(null)
function scrollToDay(day: Day, smooth = true, contextDays = 3) {
  const el = scroller.value?.querySelector<HTMLElement>(`.head-days [data-day="${day}"]`)
  const box = scroller.value
  if (!el || !box) return
  const nameCol = box.querySelector<HTMLElement>('.name')?.offsetWidth ?? 0
  const left = box.scrollLeft + el.getBoundingClientRect().left - box.getBoundingClientRect().left
  box.scrollTo({ left: Math.max(0, left - nameCol - contextDays * el.offsetWidth), behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" })
}
const monthOptions = computed(() => months.value.map((m) => ({ value: m.start, label: m.label })))
const resortOptions = RESORTS.map((r) => ({ value: r.id, label: r.name, hint: r.region }))
const resortName = computed(() => RESORTS.find((r) => r.id === props.resortId)?.name ?? 'Pick a resort')
defineExpose({ scrollToDay })
</script>

<template>
  <div
    ref="scroller"
    class="timeline"
    :class="{ picking }"
    :style="{ '--cols': days.length }"
    @pointerdown="onPickDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <div class="grid">
      <!-- Months -->
      <div class="name head corner month-jump">
        <PickMenu :options="monthOptions" :value="null" label="Go to month" menu-label="Jump to month" @pick="(d) => scrollToDay(d, false, 0)" />
      </div>
      <div class="head-months">
        <div v-for="m in months" :key="m.label" class="month" :style="{ gridColumn: `span ${m.span}` }">
          <span>{{ m.label }}</span>
        </div>
      </div>

      <!-- Days -->
      <div class="name head corner corner-low">
        <span class="hint">{{ picking ? 'Pick days in the New trip row' : 'Tap a day for details' }}</span>
      </div>
      <div class="head-days">
        <button
          v-for="d in days"
          :key="d"
          type="button"
          class="day-head"
          :aria-label="formatLong(d)"
          :class="columnClass(d)"
          :data-day="d"
          :title="[markOf(d).holiday, markOf(d).keyDate].filter(Boolean).join(' · ') || undefined"
          @click="focus(d)"
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
          @click="focus(d)"
        >
          <AppIcon v-if="heat(d) === 'all'" name="check" :size="16" />
          <span v-else-if="counts.get(d)">{{ counts.get(d) }}</span>
        </button>
      </div>

      <!-- Forecast -->
      <div class="name forecast-name">
        <div class="resort-pick">
          <small>Forecast at</small>
          <PickMenu :options="resortOptions" :value="resortId" :label="resortName" menu-label="Forecast resort" @pick="(id) => emit('resort', id)" />
        </div>
      </div>
      <div class="row forecast-row">
        <button
          v-for="d in days"
          :key="d"
          type="button"
          class="cell forecast-cell"
          :class="[columnClass(d), { fresh: (forecast?.[d]?.snowCm ?? 0) >= 5, none: !forecast?.[d] }]"
          :data-day="d"
          :aria-label="forecast?.[d] ? `${d}: ${forecast[d].kind}, ${forecast[d].snowCm} cm snow, ${forecast[d].tMin} to ${forecast[d].tMax} °C` : `${d}: no forecast yet`"
          @click="focus(d)"
        >
          <template v-if="forecast?.[d]">
            <AppIcon :name="forecast[d].kind" :size="16" />
            <span v-if="forecast[d].snowCm" class="fc-snow">{{ forecast[d].snowCm }}</span>
            <span v-else class="fc-temp">{{ forecast[d].tMax }}°</span>
          </template>
        </button>
      </div>

      <!-- Picking: one row for the trip being suggested, with the days people are free as options -->
      <template v-if="picking">
        <div class="name pick-name">
          <span class="avatar">🎿</span>
          <span class="label">
            <strong>New trip</strong>
            <small>{{ pickLabel }}</small>
          </span>
        </div>
        <div class="row pick-row">
          <div
            v-for="d in days"
            :key="d"
            class="cell pick-cell"
            :class="[columnClass(d), slotClass(d)]"
            :data-day="d"
            :title="`${counts.get(d) ?? 0} of ${total} free`"
          >
            <span class="slot" />
          </div>
        </div>
      </template>

      <!-- People -->
      <template v-for="p in picking ? [] : people" :key="p.id">
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
            <AppIcon name="more" />
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
