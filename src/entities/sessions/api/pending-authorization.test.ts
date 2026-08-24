import { describe, expect, it } from 'vitest'

import { memoryStorage } from '@/shared/lib/storage'

import { pendingAuthorizationStore } from './pending-authorization'

const PENDING = { destination: '/days/2026-08-20', state: 'the-state', verifier: 'the-verifier' }
const KEY = 'gitlab.pendingAuthorization'

describe('pendingAuthorizationStore', () => {
  it('has nothing pending to begin with', () => {
    expect(pendingAuthorizationStore(memoryStorage()).consume()).toBeNull()
  })

  it('survives the round trip out to the provider and back', () => {
    const store = pendingAuthorizationStore(memoryStorage())

    store.write(PENDING)

    expect(store.consume()).toEqual(PENDING)
  })

  it('can only be completed once, so a callback cannot be replayed', () => {
    const store = pendingAuthorizationStore(memoryStorage())

    store.write(PENDING)
    store.consume()

    expect(store.consume()).toBeNull()
  })

  it('discards the request even when it turns out to be unreadable', () => {
    const storage = memoryStorage()
    const store = pendingAuthorizationStore(storage)
    storage.write(KEY, '{ not json')

    expect(store.consume()).toBeNull()
    expect(storage.read(KEY)).toBeNull()
  })

  it('replaces an earlier attempt rather than accumulating', () => {
    const store = pendingAuthorizationStore(memoryStorage())

    store.write(PENDING)
    store.write({ ...PENDING, state: 'newer-state' })

    expect(store.consume()).toMatchObject({ state: 'newer-state' })
  })

  it.each([
    ['a value that is not an object', '42'],
    ['an array', '[1,2,3]'],
    ['null', 'null'],
    ['an object missing the verifier', '{"destination":"/","state":"s"}'],
    ['an object missing the state', '{"destination":"/","verifier":"v"}'],
    ['an object whose state is not a string', '{"destination":"/","state":1,"verifier":"v"}'],
  ])('refuses %s', (_description, stored) => {
    const storage = memoryStorage()
    storage.write(KEY, stored)

    expect(pendingAuthorizationStore(storage).consume()).toBeNull()
  })
})
