import { describe, expect, it } from 'vitest'
import { type CrewState, nextStep } from '../src/lib/nextStep'

const state = (over: Partial<CrewState> = {}): CrewState => ({
  people: 3,
  marked: 3,
  iMarked: true,
  waiting: 0,
  hasWindow: true,
  trips: [],
  ...over,
})
const kind = (over: Partial<CrewState>) => nextStep(state(over))?.kind ?? null

describe('nextStep', () => {
  it('walks the journey in order', () => {
    expect(kind({ iMarked: false, marked: 0 })).toBe('mark')
    expect(kind({ marked: 1 })).toBe('nudge')
    expect(kind({ hasWindow: false })).toBe('windows')
    expect(kind({})).toBe('suggest')
  })

  it('asks for my answer first, even with a trip on', () => {
    expect(kind({ waiting: 2, trips: [{ status: 'on' }], iMarked: false })).toBe('answer')
  })

  it('hides once a trip is on or while an open one is answered', () => {
    expect(kind({ trips: [{ status: 'on' }] })).toBeNull()
    expect(kind({ trips: [{ status: 'open' }] })).toBeNull()
    expect(kind({ trips: [{ status: 'cancelled' }] })).toBe('suggest')
  })

  it('leaves a one-person crew to the invite band', () => {
    expect(kind({ people: 1, marked: 0, iMarked: false })).toBeNull()
  })
})
