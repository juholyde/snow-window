<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
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
// Your own row comes first: it is the one you edit, and on a phone only a few rows fit.
const rows = computed(() => (picking.value ? [] : [...props.people.filter((p) => props.editable.has(p.id)), ...props.people.filter((p) => !props.editable.has(p.id))]))
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

// Keyboard: a WAI-ARIA grid with one tab stop per row. All rows share the roving column, so
// Up/Down keep the day and Tab lands on the same day in every row.
const col = ref<Day | null>(null)
const stopDay = computed<Day | null>(() => {
  if (col.value && props.days.includes(col.value)) return col.value
  return props.days.includes(today) ? today : (props.days[0] ?? null)
})
const tabStop = (d: Day) => (d === stopDay.value ? 0 : -1)
const dayState = (p: Person, d: Day) => `${formatLong(d)}, ${p.days.includes(d) ? 'free' : 'not marked'}, ${props.counts.get(d) ?? 0} of ${total.value} free`
const pickState = (d: Day) => {
  const r = lit.value
  const picked = r !== null && d >= r.start && d <= r.end
  return `${formatLong(d)}, ${picked ? 'in your trip, ' : ''}${props.counts.get(d) ?? 0} of ${total.value} free`
}

// Shift+Arrow paints (or picks) a range like a drag; releasing Shift commits it.
let shiftPick: Day | null = null
function commitKeyRange() {
  const d = drag.value
  if (!d || d.pointer !== -1) return
  drag.value = null
  const person = props.people.find((p) => p.id === d.id)
  if (!person) return
  const next = paint(person.days, d.anchor, d.current, d.mode)
  if (next.join() !== person.days.join()) emit('change', d.id, next)
}

function rowKeys(box: HTMLElement): string[] {
  return [...new Set([...box.querySelectorAll<HTMLElement>('[data-row]')].map((c) => c.dataset.row as string))]
}

async function moveTo(box: HTMLElement, row: string, day: Day) {
  col.value = day
  await nextTick()
  box.querySelector<HTMLElement>(`[data-row="${row}"][data-day="${day}"]`)?.focus()
}

function onKey(e: KeyboardEvent) {
  const box = scroller.value
  const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-row][data-day]')
  if (!box || !cell || e.altKey || e.ctrlKey || e.metaKey) return
  const row = cell.dataset.row as string
  const day = cell.dataset.day as Day
  const i = props.days.indexOf(day)
  const person = props.people.find((p) => p.id === row)
  const mine = Boolean(person) && props.editable.has(row)

  if (e.key === ' ' || e.key === 'Enter') {
    if (picking.value) {
      e.preventDefault()
      emit('pick', tapRange(props.highlight, day, MAX_TRIP_DAYS))
    } else if (mine && person) {
      e.preventDefault()
      commitKeyRange()
      emit('change', row, paint(person.days, day, day, modeFor(person.days, day)))
    }
    return
  }

  let target: Day | undefined
  let nextRow = row
  const rows = rowKeys(box)
  const r = rows.indexOf(row)
  const monthAt = months.value.filter((m) => m.start <= day).length - 1
  if (e.key === 'ArrowRight') target = props.days[i + 1]
  else if (e.key === 'ArrowLeft') target = props.days[i - 1]
  else if (e.key === 'Home') target = props.days[0]
  else if (e.key === 'End') target = props.days[props.days.length - 1]
  else if (e.key === 'PageDown') target = months.value[monthAt + 1]?.start ?? props.days[props.days.length - 1]
  else if (e.key === 'PageUp') target = months.value[monthAt]?.start === day ? months.value[monthAt - 1]?.start : months.value[monthAt]?.start
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    nextRow = rows[r + (e.key === 'ArrowDown' ? 1 : -1)] ?? row
    target = day
  } else return
  e.preventDefault()
  if (!target) return

  const horizontal = e.key !== 'ArrowDown' && e.key !== 'ArrowUp'
  if (e.shiftKey && horizontal && picking.value) {
    shiftPick ??= day
    emit('pick', span(shiftPick, target, MAX_TRIP_DAYS))
  } else if (e.shiftKey && horizontal && mine && person) {
    if (!drag.value) drag.value = { id: row, anchor: day, current: day, mode: modeFor(person.days, day), pointer: -1 }
    drag.value.current = target
  } else commitKeyRange()
  void moveTo(box, nextRow, target)
}

function onKeyUp(e: KeyboardEvent) {
  if (e.key !== 'Shift') return
  shiftPick = null
  commitKeyRange()
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
    @keydown="onKey"
    @keyup="onKeyUp"
    @focusin="(e) => { const d = (e.target as HTMLElement).dataset.day as Day | undefined; if (d && (e.target as HTMLElement).dataset.row) col = d }"
  >
    <div class="grid" role="grid" :aria-label="picking ? 'Pick trip dates' : 'Crew availability'">
      <div class="grow" role="row">
      <!-- Months -->
      <div class="name head corner month-jump" role="rowheader">
        <PickMenu :options="monthOptions" :value="null" label="Go to month" menu-label="Jump to month" @pick="(d) => scrollToDay(d, false, 0)" />
      </div>
      <div class="head-months" role="presentation">
        <div v-for="m in months" :key="m.label" class="month" :style="{ gridColumn: `span ${m.span}` }">
          <span>{{ m.label }}</span>
        </div>
      </div>

      </div>

      <!-- Days -->
      <div class="grow" role="row" aria-label="Days">
      <div class="name head corner corner-low" role="rowheader">
        <span class="hint">{{ picking ? 'Pick days in the New trip row' : 'Tap a day for details' }}</span>
      </div>
      <div class="head-days" role="presentation">
        <button
          v-for="d in days"
          :key="d"
          type="button"
          class="day-head"
          role="gridcell"
          data-row="head"
          :tabindex="tabStop(d)"
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

      </div>

      <!-- Overlap -->
      <div class="grow" role="row" aria-label="Whole crew">
      <div class="name overlap-name" role="rowheader">
        <span class="avatar">🏔️</span>
        <span class="label">
          <strong>Whole crew</strong>
          <small>{{ total }}/{{ people.length }} marked</small>
        </span>
      </div>
      <div class="row overlap-row" role="presentation">
        <button
          v-for="d in days"
          :key="d"
          type="button"
          class="cell overlap-cell"
          role="gridcell"
          data-row="overlap"
          :tabindex="tabStop(d)"
          :class="[columnClass(d), heat(d)]"
          :data-day="d"
          :aria-label="`${d}: ${counts.get(d) ?? 0} of ${total} free`"
          @click="focus(d)"
        >
          <AppIcon v-if="heat(d) === 'all'" name="check" :size="16" />
          <span v-else-if="counts.get(d)">{{ counts.get(d) }}</span>
        </button>
      </div>

      </div>

      <!-- Forecast -->
      <div class="grow" role="row" aria-label="Forecast">
      <div class="name forecast-name" role="rowheader">
        <div class="resort-pick">
          <small>Forecast at</small>
          <PickMenu :options="resortOptions" :value="resortId" :label="resortName" menu-label="Forecast resort" @pick="(id) => emit('resort', id)" />
        </div>
      </div>
      <div class="row forecast-row" role="presentation">
        <button
          v-for="d in days"
          :key="d"
          type="button"
          class="cell forecast-cell"
          role="gridcell"
          data-row="forecast"
          :tabindex="tabStop(d)"
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
      </div>

      <template v-if="picking">
        <div class="grow" role="row" aria-label="New trip">
        <div class="name pick-name" role="rowheader">
          <span class="avatar">🎿</span>
          <span class="label">
            <strong>New trip</strong>
            <small>{{ pickLabel }}</small>
          </span>
        </div>
        <div class="row pick-row" role="presentation">
          <div
            v-for="d in days"
            :key="d"
            class="cell pick-cell"
            role="gridcell"
            data-row="pick"
            :tabindex="tabStop(d)"
            :aria-label="pickState(d)"
            :class="[columnClass(d), slotClass(d)]"
            :data-day="d"
            :title="`${counts.get(d) ?? 0} of ${total} free`"
          >
            <span class="slot" />
          </div>
        </div>
        </div>
      </template>

      <!-- People -->
      <template v-for="p in rows" :key="p.id">
        <div class="grow" role="row" :aria-label="p.name">
        <div class="name person-name" :class="{ mine: editable.has(p.id) }" role="rowheader">
          <span class="avatar">{{ p.emoji }}</span>
          <span class="label">
            <strong :title="p.name">{{ p.name }}</strong>
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
        <div class="row" :class="{ editable: editable.has(p.id) }" role="presentation">
          <div
            v-for="d in days"
            :key="d"
            class="cell"
            role="gridcell"
            :data-row="p.id"
            :tabindex="tabStop(d)"
            :aria-label="dayState(p, d)"
            :aria-selected="shownDays(p).has(d)"
            :aria-readonly="!editable.has(p.id)"
            :class="[columnClass(d), { free: shownDays(p).has(d) }]"
            :data-day="d"
            @pointerdown="onDown($event, p, d)"
          />
        </div>
        </div>
      </template>
      <slot name="footer" />
    </div>
  </div>
</template>
