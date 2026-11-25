import { SEASON } from '../config/calendar'
import { type Day, isDay } from './dates'

/** Guardrails for a public board without sign-in. The migration enforces the same limits. */
export const MAX_PEOPLE = 20
export const MAX_CREW_NAME = 40
export const MAX_NAME = 24
export const MAX_EMOJI = 16

export function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) throw new Error('Name is required')
  if ([...trimmed].length > MAX_NAME) throw new Error(`Name is at most ${MAX_NAME} characters`)
  return trimmed
}

export function cleanEmoji(emoji: string): string {
  const trimmed = emoji.trim()
  if (!trimmed) throw new Error('Pick an emoji')
  if (trimmed.length > MAX_EMOJI) throw new Error('Pick a single emoji')
  return trimmed
}

/** Sorted, unique, inside the season; throws on anything else. */
export function cleanDays(days: readonly string[]): Day[] {
  for (const d of days) {
    if (!isDay(d)) throw new Error(`Not a date: ${d}`)
    if (d < SEASON.start || d > SEASON.end) throw new Error(`${d} is outside the season`)
  }
  return [...new Set(days)].sort()
}
