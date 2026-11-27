// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { drawTripCard } from '../src/lib/shareCard'
import type { Trip } from '../src/lib/trips'

it('draws nothing, and does not throw, when the browser has no 2D canvas context', async () => {
  const trip: Trip = {
    id: 't', proposerId: 'a', resortId: 'cerler', start: '2027-01-02', end: '2027-01-05', title: null, note: null,
    status: 'on', createdAt: '0', responses: {}, stayBudget: null, driving: null, stays: [], bookedStay: null,
  }
  HTMLCanvasElement.prototype.getContext = () => null
  await expect(drawTripCard(trip, [], '/')).resolves.toBeNull()
})
