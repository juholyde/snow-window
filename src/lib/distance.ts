/** Distance and travel hints from a home city to a resort, in the browser with no service. */
export type Point = { lat: number; lon: number }
export type Hint = { km: number; mode: 'drive' | 'fly'; roadKm?: number; driveMinutes?: number }

/**
 * Calibrated on the 7 checked Barcelona car trips in resorts.ts (Baqueira, La Molina, Grandvalira,
 * Pal Arinsal, Formigal, Cerler, Sierra Nevada):
 * - road km = straight line x 1.35. Off by -25% (Baqueira, mountain roads) to +4% (Sierra Nevada).
 * - drive minutes = 40 + road km x 0.72 (about 83 km/h plus 40 min for city exit and mountain roads).
 *   Off by -21% to +20% on the same 7.
 */
export const DETOUR_FACTOR = 1.35
export const DRIVE_BASE_MINUTES = 40
export const DRIVE_MINUTES_PER_KM = 0.72
/** Beyond this straight-line distance driving stops being sensible. */
export const FLY_THRESHOLD_KM = 950

const EARTH_RADIUS_KM = 6371

/** Great-circle (haversine) distance in whole km. */
export function km(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)))
}

/** Which side of the Baltic a point is on: Finland, Estonia, or everywhere else (Sweden, the south and the west). */
function baltic(p: Point): 'fi' | 'ee' | 'other' {
  if (p.lon < 21.5) return 'other'
  if (p.lat >= 59.8) return 'fi'
  if (p.lat >= 57.5) return 'ee'
  return 'other'
}

/**
 * Drive or fly? Fly when the straight line is over 950 km, or when the sea is in between: the rule is
 * deliberately crude. Finland and Estonia count as separate shores of the Baltic, so Helsinki to Tallinn
 * (a ferry), and Finland or Estonia to anywhere west of 21.5 degrees east (Sweden, Norway, Germany)
 * come out as 'fly'. Points on the same shore drive, and so do two points both north of 64 degrees,
 * where the road runs round the Bothnian Bay.
 */
export function hint(from: Point, to: Point): Hint {
  const straight = km(from, to)
  const shoreA = baltic(from)
  const shoreB = baltic(to)
  // North of 64 degrees Finland and Sweden join by land around the Bothnian Bay (Tornio–Haparanda).
  const bothNorth = from.lat >= 64 && to.lat >= 64
  const seaBetween = !bothNorth && shoreA !== shoreB && (shoreA !== 'other' || shoreB !== 'other')
  if (straight > FLY_THRESHOLD_KM || seaBetween) return { km: straight, mode: 'fly' }
  const roadKm = Math.round(straight * DETOUR_FACTOR)
  const driveMinutes = Math.round(DRIVE_BASE_MINUTES + roadKm * DRIVE_MINUTES_PER_KM)
  return { km: straight, mode: 'drive', roadKm, driveMinutes }
}

function duration(minutes: number): string {
  const quarters = Math.round(minutes / 15)
  const h = Math.floor(quarters / 4)
  const m = (quarters % 4) * 15
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** "320 km · ~4h by car" or "2,950 km · fly". */
export function formatHint(h: Hint): string {
  if (h.mode === 'fly') return `${h.km.toLocaleString('en-US')} km · fly`
  return `${(h.roadKm ?? h.km).toLocaleString('en-US')} km · ~${duration(h.driveMinutes ?? 0)} by car`
}
