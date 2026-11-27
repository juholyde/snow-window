// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { closeApps, openApp, resetBrowser, seedCrew, seedTrip, storeFor } from './helpers/app'

beforeEach(resetBrowser)
afterEach(closeApps)

const text = () => document.body.textContent ?? ''
const click = async (el: Element | null | undefined) => {
  if (!el) throw new Error('Nothing to click')
  ;(el as HTMLElement).click()
  await flushPromises()
}
const buttonNamed = (name: string | RegExp) =>
  [...document.querySelectorAll('button')].find((b) => (typeof name === 'string' ? b.textContent?.trim() === name : name.test(b.textContent ?? '')))
const typeInto = async (el: Element | null, value: string) => {
  const input = el as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}
/** A tap on one of my row's cells: pointer down there, pointer up on the timeline. */
const tapDay = async (day: string) => {
  const cell = document.querySelector(`.row.editable [data-day="${day}"]`)
  if (!cell) throw new Error(`No editable cell for ${day}`)
  cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }))
  cell.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }))
  await flushPromises()
}
const tab = (name: RegExp) => [...document.querySelectorAll('[role=tab]')].find((t) => name.test(t.textContent ?? ''))

it('marking days on my row moves the count and the overlap, and is saved', async () => {
  await openApp('ann')
  // First visit: start a crew through the welcome card.
  await typeInto(document.querySelector('input[aria-label="Your name"]'), 'Ann')
  await typeInto(document.querySelector('input[placeholder="Pyrenees gang"]'), 'Pyrenees gang')
  await click(buttonNamed('Create crew'))
  expect(text()).toContain('you · 0 days')
  expect(text()).toContain('0/1 marked')

  await tapDay('2026-12-05')
  await tapDay('2026-12-06')

  expect(text()).toContain('you · 2 days')
  expect(text()).toContain('1/1 marked')
  expect(document.querySelector('[aria-label="2026-12-05: 1 of 1 free"]')).not.toBeNull()
  // Saved to the store, not only drawn.
  expect((await storeFor('ann').profile())?.days).toEqual(['2026-12-05', '2026-12-06'])

  // Tapping a marked day again clears it.
  await tapDay('2026-12-06')
  expect(text()).toContain('you · 1 days')
})

it('a second person joins by invite link and lands in the crew', async () => {
  const { code, ownerStore } = await seedCrew('Pyrenees gang', [{ id: 'ann', name: 'Ann', days: ['2026-12-05'] }])
  location.hash = `#join=${code}`
  await openApp('ben')

  expect(text()).toContain('Join Pyrenees gang')
  await typeInto(document.querySelector('input[aria-label="Your name"]'), 'Ben')
  await click(buttonNamed('Join the crew'))

  expect(text()).toContain("You're in Pyrenees gang")
  // Ben sees Ann's row on the shared board, and the invite is gone from the address.
  expect(text()).toContain('Ann')
  expect(text()).toContain('1/2 marked')
  expect(location.hash).toBe('')
  expect((await ownerStore.crews())[0]?.members).toBe(2)
})

it('answering Going updates the tally and clears the unanswered badge', async () => {
  const seed = await seedCrew('Pyrenees gang', [
    { id: 'ann', name: 'Ann', days: ['2026-12-05', '2026-12-06'] },
    { id: 'ben', name: 'Ben', days: ['2026-12-05', '2026-12-06'] },
  ])
  await seedTrip(seed, { start: '2026-12-05', end: '2026-12-06' })
  await openApp('ben')

  await click(tab(/Trips/))
  expect(text()).toContain('Your answer?')
  const going = () => buttonNamed('Going')
  expect(going()?.getAttribute('aria-pressed')).toBe('false')
  expect(document.querySelector('.tally .g-yes')?.textContent).toContain('Going 1')

  await click(going())

  expect(text()).not.toContain('Your answer?')
  expect(going()?.getAttribute('aria-pressed')).toBe('true')
  expect(document.querySelector('.tally .g-yes')?.textContent).toContain('Going 2')
  expect((await storeFor('ann').loadCrew(seed.crewId)).trips[0]?.responses).toMatchObject({ ann: 'yes', ben: 'yes' })
})

it('pasted STAY lines become places, a vote counts, and Booked it shows the booked place', async () => {
  const seed = await seedCrew('Pyrenees gang', [{ id: 'ann', name: 'Ann', days: ['2026-12-05', '2026-12-06', '2026-12-07'] }])
  await seedTrip(seed, { start: '2026-12-05', end: '2026-12-07', on: true })
  await openApp('ann')

  await click(tab(/Trips/))
  await click(buttonNamed(/Paste answer/))
  await typeInto(
    document.querySelector('textarea[aria-label="The chatbot\'s answer"]'),
    'Sure! Here you go\nSTAY | Hotel Tuca | https://example.com/tuca | 60 | Ski-in, ski-out\nSTAY | Chalet Aran | https://example.com/aran | 45 | Sauna',
  )
  await click(buttonNamed('Add places'))
  expect(text()).toContain('2 places added.')
  expect(text()).toContain('Hotel Tuca')
  expect(text()).toContain('Chalet Aran')
  expect(text()).not.toContain('Booked:')

  const vote = document.querySelector<HTMLElement>('button.vote')
  expect(vote?.getAttribute('aria-pressed')).toBe('false')
  await click(vote)
  expect(document.querySelector('button.vote[aria-pressed=true]')?.textContent).toContain('1')

  // Book the second place, found by its row.
  const row = [...document.querySelectorAll('.stay-options li')].find((li) => li.textContent?.includes('Chalet Aran'))
  await click([...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === 'Booked it'))

  expect(text()).toContain('Booked: Chalet Aran')
  const booked = (await storeFor('ann').loadCrew(seed.crewId)).trips[0]
  expect(booked?.stays.find((s) => s.id === booked.bookedStay)?.name).toBe('Chalet Aran')
})

it('the last Going shows the Rufus banner once, and it does not come back after dismissing', async () => {
  const seed = await seedCrew('Pyrenees gang', [
    { id: 'ann', name: 'Ann', days: ['2026-12-05', '2026-12-06'] },
    { id: 'ben', name: 'Ben', days: ['2026-12-05', '2026-12-06'] },
  ])
  await seedTrip(seed, { start: '2026-12-05', end: '2026-12-06' })
  await storeFor('ann').respond((await storeFor('ann').loadCrew(seed.crewId)).trips[0]?.id ?? '', 'yes')
  const app = await openApp('ben')
  await click(tab(/Trips/))
  expect(document.querySelector('.celebrate')).toBeNull()

  await click(buttonNamed('Going'))
  expect(document.querySelector('.celebrate')).not.toBeNull()
  expect(document.querySelector('.celebrate img')?.getAttribute('src')).toContain('rufus-snowboard')

  await click(document.querySelector('.celebrate button'))
  expect(document.querySelector('.celebrate')).toBeNull()
  app.unmount()
  await openApp('ben')
  await click(tab(/Trips/))
  expect(document.querySelector('.celebrate')).toBeNull()
})

it('days can be marked by keyboard: roving stop, Space toggles, Shift+Arrow paints a range', async () => {
  await openApp('ann')
  await typeInto(document.querySelector('input[aria-label="Your name"]'), 'Ann')
  await typeInto(document.querySelector('input[placeholder="Pyrenees gang"]'), 'Pyrenees gang')
  await click(buttonNamed('Create crew'))

  const own = () => document.querySelector('.row.editable') as HTMLElement
  expect(own().querySelectorAll('[tabindex="0"]').length).toBe(1)
  const cell = (day: string) => own().querySelector(`[data-day="${day}"]`) as HTMLElement
  const key = async (el: Element, k: string, shiftKey = false, type = 'keydown') => {
    el.dispatchEvent(new KeyboardEvent(type, { key: k, shiftKey, bubbles: true, cancelable: true }))
    await flushPromises()
  }

  cell('2026-12-05').focus()
  expect(cell('2026-12-05').getAttribute('aria-label')).toBe('Sat 5 Dec, not marked, 0 of 0 free')
  await key(cell('2026-12-05'), ' ')
  expect(cell('2026-12-05').getAttribute('aria-label')).toContain('free,')
  expect((await storeFor('ann').profile())?.days).toEqual(['2026-12-05'])

  await key(cell('2026-12-05'), 'ArrowRight')
  expect(document.activeElement).toBe(cell('2026-12-06'))
  expect(own().querySelectorAll('[tabindex="0"]').length).toBe(1)
  await key(cell('2026-12-06'), 'ArrowRight', true)
  await key(cell('2026-12-07'), 'ArrowRight', true)
  await key(cell('2026-12-08'), 'Shift', true, 'keyup')
  expect((await storeFor('ann').profile())?.days).toEqual(['2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08'])
})
