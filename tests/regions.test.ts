import { describe, expect, it } from 'vitest'
import { LocalStore } from '../src/lib/store'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('LocalStore home city and crew regions', () => {
  it('validates the city, clears it, and shows it to the crew', async () => {
    const storage = memory()
    const me = new LocalStore(storage, 'me')
    await expect(me.setHomeCity('barcelona')).rejects.toThrow('Pick a name')
    await me.saveProfile('Juho', '🏂')
    const crewId = await me.createCrew('Gang')
    await expect(me.setHomeCity('atlantis')).rejects.toThrow('city')
    await me.setHomeCity('barcelona')
    await me.saveProfile('Juho', '⛷️')
    expect((await me.loadCrew(crewId)).people[0]?.homeCity).toBe('barcelona')
    await me.setHomeCity(null)
    expect((await me.profile())?.homeCity).toBeNull()
  })

  it('keeps regions non-empty, known, deduped and ordered, for members only; defaults to spain', async () => {
    const storage = memory()
    const me = new LocalStore(storage, 'me')
    const out = new LocalStore(storage, 'out')
    await me.saveProfile('Juho', '🏂')
    const crewId = await me.createCrew('Gang')
    expect((await me.crews())[0]?.regions).toEqual(['spain'])
    await me.setCrewRegions(crewId, ['sweden', 'alps', 'sweden'])
    expect((await me.crews())[0]?.regions).toEqual(['alps', 'sweden'])
    await expect(me.setCrewRegions(crewId, [])).rejects.toThrow('area')
    await expect(me.setCrewRegions(crewId, ['norway' as never])).rejects.toThrow('area')
    await expect(out.setCrewRegions(crewId, ['alps'])).rejects.toThrow("not in that crew")
  })

  it('loads data saved before these fields existed', async () => {
    const storage = memory()
    storage.setItem(
      'snow-window:local',
      JSON.stringify({
        profiles: { me: { id: 'me', name: 'Old', emoji: '🏂', days: [] } },
        crews: [{ id: 'c', name: 'Old gang', ownerId: 'me', inviteCode: 'x', members: [{ userId: 'me', joinedAt: '2026-01-01' }] }],
      }),
    )
    const me = new LocalStore(storage, 'me')
    expect((await me.profile())?.homeCity).toBeNull()
    expect((await me.crews())[0]?.regions).toEqual(['spain'])
    expect((await me.loadCrew('c')).people[0]?.homeCity).toBeNull()
  })
})
