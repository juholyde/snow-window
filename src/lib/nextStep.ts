import type { Trip } from './trips'

export type StepKind = 'answer' | 'mark' | 'nudge' | 'suggest' | 'windows'
export type Step = { kind: StepKind; text: string; button: string | null }

export type CrewState = {
  /** People in the crew; with fewer than two the invite band owns the board. */
  people: number
  /** People who have marked at least one day, and whether I am one of them. */
  marked: number
  iMarked: boolean
  /** Trips waiting on my answer. */
  waiting: number
  /** Whether the crew shares at least one free stretch. */
  hasWindow: boolean
  trips: readonly Pick<Trip, 'status'>[]
}

/** The one thing the crew should do next, or null when nothing needs saying. */
export function nextStep(s: CrewState): Step | null {
  if (s.waiting > 0) {
    const text = s.waiting === 1 ? 'A trip is waiting for your answer.' : `${s.waiting} trips are waiting for your answer.`
    return { kind: 'answer', text, button: 'Answer' }
  }
  if (s.people < 2) return null
  if (s.trips.some((t) => t.status === 'on')) return null
  if (!s.iMarked) return { kind: 'mark', text: 'Mark the days you are free: tap your row below.', button: null }
  if (s.marked < 2) return { kind: 'nudge', text: 'Waiting for the others to mark their days.', button: 'Copy invite link' }
  if (s.trips.some((t) => t.status === 'open')) return null
  if (s.hasWindow) return { kind: 'suggest', text: 'You share free days. Suggest a trip.', button: 'Suggest a trip' }
  return { kind: 'windows', text: 'No shared stretch yet. See where days nearly line up.', button: 'Snow windows' }
}
