import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { ERROR_COPY } from '../src/lib/store'
import { SupabaseStore } from '../src/lib/supabaseStore'

const store = (rpc: unknown, anon: unknown = {}) =>
  new SupabaseStore(
    {
      schema: () => ({ rpc: async () => rpc }),
      auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously: async () => anon },
    } as unknown as SupabaseClient,
    'http://x/',
  )

describe('SupabaseStore errors', () => {
  it('tells an expired token to sign in again', async () => {
    const expired = { data: null, status: 401, error: { code: 'PGRST301', message: 'JWT expired' } }
    await expect(store(expired).crews()).rejects.toThrow(ERROR_COPY.not_signed_in)
  })

  it('tells a rate-limited guest to try later', async () => {
    const limited = { data: { session: null }, error: { code: 'over_request_rate_limit', status: 429, message: 'Request rate limit reached' } }
    await expect(store({}, limited).session()).rejects.toThrow(ERROR_COPY.guest_limit)
  })

  it('keeps database error codes and unknown messages', async () => {
    await expect(store({ error: { message: 'raise crew_full' }, status: 400 }).crews()).rejects.toThrow(ERROR_COPY.crew_full)
    await expect(store({ error: { message: 'boom' }, status: 500 }).crews()).rejects.toThrow('boom')
  })
})
