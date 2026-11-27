import { existsSync } from 'node:fs'
import { expect, it } from 'vitest'
import { AREAS, RESORTS } from '../src/config/resorts'

it('gives every resort a known area, a unique id and a photo file', () => {
  const areas = AREAS.map((a) => a.id)
  expect(new Set(RESORTS.map((r) => r.id)).size).toBe(RESORTS.length)
  for (const r of RESORTS) {
    expect(areas, r.id).toContain(r.area)
    expect(r.id, r.id).toMatch(/^[a-z-]+$/)
    expect(existsSync(`public/${r.photo.file}`), r.photo.file).toBe(true)
  }
})
