import { type Day, eachDay } from './dates'

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
