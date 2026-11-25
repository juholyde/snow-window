import type { Day } from '../lib/dates'

/** The ski season the timeline covers. The database checks the same range (migration). */
export const SEASON = { start: '2026-12-01', end: '2027-04-30' } as const satisfies Record<string, Day>

export type Holiday = { date: Day; name: string; scope: 'Spain' | 'Catalonia' }

/**
 * Spain-wide holidays plus Catalonia's, inside the season.
 * Sources: BOE national calendar; Catalonia 2027 from Ordre EMT/52/2026 (Good Friday 26 Mar,
 * Easter Monday 29 Mar). Holy Thursday is regional and not a holiday in Catalonia, so it is left out.
 */
export const HOLIDAYS: Holiday[] = [
  { date: '2026-12-06', name: 'Constitution Day', scope: 'Spain' },
  { date: '2026-12-08', name: 'Immaculate Conception', scope: 'Spain' },
  { date: '2026-12-25', name: 'Christmas Day', scope: 'Spain' },
  { date: '2026-12-26', name: 'Sant Esteve', scope: 'Catalonia' },
  { date: '2027-01-01', name: "New Year's Day", scope: 'Spain' },
  { date: '2027-01-06', name: 'Epiphany (Reyes)', scope: 'Spain' },
  { date: '2027-03-26', name: 'Good Friday', scope: 'Spain' },
  { date: '2027-03-29', name: 'Easter Monday', scope: 'Catalonia' },
]

export type KeyDate = { start: Day; end: Day; name: string }

/** Dates Juho picked to highlight. Add more here. */
export const KEY_DATES: KeyDate[] = [{ start: '2026-12-28', end: '2026-12-31', name: 'Scopely winter break' }]
