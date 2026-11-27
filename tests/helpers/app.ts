import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { vi } from 'vitest'
import App from '../../src/App.vue'
import { LocalStore } from '../../src/lib/store'

/** Two people sharing one browser storage: each is a LocalStore with its own user id. */
export const storeFor = (userId: string) => new LocalStore(localStorage, userId)

const mounted: VueWrapper[] = []

/** Unmounts every opened app and restores fetch, so a failing test leaves nothing for the next. */
export function closeApps() {
  for (const w of mounted.splice(0)) w.unmount()
  vi.unstubAllGlobals()
}

/** No network in tests: the Open-Meteo forecast fails, and the board shows without one. */
export function resetBrowser() {
  localStorage.clear()
  location.hash = ''
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
}

/** Opens the app as one person and waits for its first load. */
export async function openApp(userId: string): Promise<VueWrapper> {
  const wrapper = mount(App, { props: { store: storeFor(userId) }, attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

/** A crew with the given people, set up through the stores; the first is the owner. Returns its invite code. */
export async function seedCrew(crewName: string, people: { id: string; name: string; days?: string[] }[]) {
  const [owner, ...rest] = people
  if (!owner) throw new Error('seedCrew needs an owner')
  const ownerStore = storeFor(owner.id)
  await ownerStore.saveProfile(owner.name, '🏂')
  await ownerStore.setDays(owner.days ?? [])
  const crewId = await ownerStore.createCrew(crewName)
  const code = (await ownerStore.crews())[0]?.inviteCode ?? ''
  for (const p of rest) {
    const s = storeFor(p.id)
    await s.saveProfile(p.name, '🎿')
    await s.setDays(p.days ?? [])
    await s.joinCrew(code)
  }
  return { crewId, code, ownerStore }
}

/** Seeds a suggested trip by the owner; with `on`, marks it on. */
export async function seedTrip(
  seed: Awaited<ReturnType<typeof seedCrew>>,
  opts: { start: string; end: string; on?: boolean },
) {
  const id = await seed.ownerStore.createTrip(seed.crewId, { resortId: 'baqueira', title: 'Powder run', note: '', ...opts })
  if (opts.on) await seed.ownerStore.setTripStatus(id, 'on')
  return id
}
