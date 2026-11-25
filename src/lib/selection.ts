import { addDays, type Day, eachDay } from './dates'

export type PaintMode = 'add' | 'remove'

/** Dragging from `anchor` to `current` adds or removes every day between them. */
export function paint(days: readonly Day[], anchor: Day, current: Day, mode: PaintMode): Day[] {
  const [from, to] = anchor <= current ? [anchor, current] : [current, anchor]
  const set = new Set(days)
  for (const d of eachDay(from, to)) {
    if (mode === 'add') set.add(d)
    else set.delete(d)
  }
  return [...set].sort()
}

/** A drag that starts on a free day clears; one that starts on an empty day fills. */
export function modeFor(days: readonly Day[], anchor: Day): PaintMode {
  return days.includes(anchor) ? 'remove' : 'add'
}

export type Range = { start: Day; end: Day }

/** The stretch between two days in either order, cut to at most `maxDays` days from its start. */
export function span(a: Day, b: Day, maxDays: number): Range {
  const [start, end] = a <= b ? [a, b] : [b, a]
  const last = addDays(start, maxDays - 1)
  return { start, end: end > last ? last : end }
}

/**
 * Tapping picks dates in two steps: the first tap picks one day; a tap on a later day
 * stretches that day into a range. Any other tap starts again from the tapped day.
 */
export function tapRange(current: Range | null, day: Day, maxDays: number): Range {
  if (current && current.start === current.end && day > current.start) return span(current.start, day, maxDays)
  return { start: day, end: day }
}
