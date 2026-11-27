import { RESORTS } from '../config/resorts'
import { formatLong } from './dates'
import type { Person } from './overlap'
import { icsFilename } from './ics'
import { nights, type Trip, tally } from './trips'

export const CARD_W = 1080
export const CARD_H = 1350
const PHOTO_H = 740
const MAX_GOING = 8
const MAX_NAME = 12
const MAX_TITLE = 38

export type CardLayout = {
  heading: string
  /** Resort name when the heading is a custom title, else null. */
  resortLine: string | null
  dates: string
  going: string[]
  more: number
  stay: string | null
  credit: string
}

/** Cut to `max` characters with an ellipsis. */
export const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`)

/** What the card says, decided without a canvas: truncation and the Going cap live here. */
export function cardLayout(trip: Trip, people: readonly Person[]): CardLayout {
  const resort = RESORTS.find((r) => r.id === trip.resortId)
  const resortName = resort?.name ?? trip.resortId
  const n = nights(trip)
  const year = trip.end.slice(0, 4)
  const dates = n === 0 ? `${formatLong(trip.start)} ${year}` : `${formatLong(trip.start)} – ${formatLong(trip.end)} ${year}`
  const yes = tally(trip, people).yes.map((p) => `${p.emoji} ${clip(p.name, MAX_NAME)}`)
  const stay = trip.stays.find((s) => s.id === trip.bookedStay)
  return {
    heading: clip(trip.title || resortName, MAX_TITLE),
    resortLine: trip.title ? resortName : null,
    dates: `${dates} · ${n === 0 ? 'day trip' : `${n} ${n === 1 ? 'night' : 'nights'}`}`,
    going: yes.slice(0, MAX_GOING),
    more: Math.max(0, yes.length - MAX_GOING),
    stay: stay ? clip(stay.name, 44) : null,
    credit: resort ? `Photo: ${clip(resort.photo.author, 40)}, ${resort.photo.license}, Wikimedia Commons` : '',
  }
}

export const cardFilename = (trip: Trip) => icsFilename(trip).replace(/\.ics$/, '.png')

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const DISPLAY = '"Big Shoulders Display Variable", ui-sans-serif, system-ui, sans-serif'

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })

/** Shrink `px` until the text fits `maxW`, for headings that would otherwise overflow. */
function shrinkToFit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, px: number, maxW: number) {
  let size = px
  ctx.font = font(size)
  while (size > 40 && ctx.measureText(text).width > maxW) {
    size -= 4
    ctx.font = font(size)
  }
}

/** Paints the trip card onto a 1080x1350 canvas. Returns null when there is no 2D context (happy-dom). */
export async function drawTripCard(trip: Trip, people: readonly Person[], base: string): Promise<HTMLCanvasElement | null> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const L = cardLayout(trip, people)
  const resort = RESORTS.find((r) => r.id === trip.resortId)
  try {
    await Promise.all([document.fonts.load(`800 80px ${DISPLAY}`), document.fonts.load(`700 40px ${SANS}`)])
  } catch {
    // Fall back to the system font rather than refuse to share.
  }

  ctx.fillStyle = '#f5f1e9'
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Photo, cover-cropped into the top band.
  if (resort) {
    try {
      const img = await loadImage(base + resort.photo.file)
      const s = Math.max(CARD_W / img.width, PHOTO_H / img.height)
      const w = img.width * s
      const h = img.height * s
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, CARD_W, PHOTO_H)
      ctx.clip()
      ctx.drawImage(img, (CARD_W - w) / 2, (PHOTO_H - h) / 2, w, h)
      ctx.restore()
    } catch {
      ctx.fillStyle = '#24243d'
      ctx.fillRect(0, 0, CARD_W, PHOTO_H)
    }
  }
  const shade = ctx.createLinearGradient(0, PHOTO_H - 140, 0, PHOTO_H)
  shade.addColorStop(0, 'rgba(36,36,61,0)')
  shade.addColorStop(1, 'rgba(36,36,61,0.55)')
  ctx.fillStyle = shade
  ctx.fillRect(0, PHOTO_H - 140, CARD_W, 140)
  if (L.credit) {
    ctx.font = `500 20px ${SANS}`
    ctx.fillStyle = 'rgba(255,253,248,0.85)'
    ctx.textAlign = 'right'
    ctx.fillText(L.credit, CARD_W - 32, PHOTO_H - 22)
  }
  ctx.fillStyle = '#ff9569'
  ctx.fillRect(0, PHOTO_H, CARD_W, 12)

  // Text block.
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const x = 72
  const maxW = CARD_W - x * 2
  ctx.fillStyle = '#9b351a'
  ctx.font = `800 40px ${DISPLAY}`
  ctx.fillText(L.dates.toUpperCase(), x, PHOTO_H + 78)
  ctx.fillStyle = '#24243d'
  shrinkToFit(ctx, L.heading, (px) => `800 ${px}px ${DISPLAY}`, 128, maxW)
  ctx.fillText(L.heading, x, PHOTO_H + 206)
  let y = PHOTO_H + 206
  if (L.resortLine) {
    y += 52
    ctx.fillStyle = '#494960'
    ctx.font = `600 38px ${SANS}`
    ctx.fillText(L.resortLine, x, y)
  }

  y += 76
  ctx.fillStyle = '#23777b'
  ctx.font = `800 34px ${DISPLAY}`
  ctx.fillText('GOING', x, y)
  ctx.fillStyle = '#24243d'
  ctx.font = `600 36px ${SANS}`
  const chips = L.going.length ? [...L.going, ...(L.more ? [`+${L.more} more`] : [])] : ['Nobody yet']
  let cx = x
  y += 56
  for (const chip of chips) {
    const w = ctx.measureText(chip).width
    if (cx > x && cx + w > x + maxW) {
      cx = x
      y += 56
    }
    ctx.fillText(chip, cx, y)
    cx += w + 36
  }
  if (L.stay) {
    y += 76
    ctx.fillStyle = '#494960'
    ctx.font = `600 32px ${SANS}`
    ctx.fillText(`Staying at ${L.stay}`, x, y)
  }

  // Footer wordmark.
  try {
    const logo = await loadImage(`${base}art/logo-wordmark@512.png`)
    const lw = 260
    ctx.drawImage(logo, x - 12, CARD_H - 36 - (logo.height * lw) / logo.width, lw, (logo.height * lw) / logo.width)
  } catch {
    ctx.fillStyle = '#24243d'
    ctx.font = `800 44px ${DISPLAY}`
    ctx.fillText('SNOW WINDOW', x, CARD_H - 56)
  }
  return canvas
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'))

/** Render the card and share it as a file, or download it when the browser cannot share files. */
export async function shareTripCard(trip: Trip, people: readonly Person[], text: string, base: string): Promise<void> {
  const canvas = await drawTripCard(trip, people, base)
  const blob = canvas && (await toBlob(canvas))
  if (!blob) throw new Error('Could not draw the card in this browser.')
  const file = new File([blob], cardFilename(trip), { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      throw e
    }
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
