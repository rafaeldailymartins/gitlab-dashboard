import { describe, expect, it } from 'vitest'

import { memoryStorage } from '@/shared/lib/storage'

import { rememberedGroup, rememberGroup } from './remembered'

describe('rememberGroup', () => {
  it('brings the choice back on the next visit', () => {
    const storage = memoryStorage()

    rememberGroup(storage, 'acme/squad')

    expect(rememberedGroup(storage)).toBe('acme/squad')
  })

  it('forgets it when the choice is cleared', () => {
    const storage = memoryStorage()

    rememberGroup(storage, 'acme/squad')
    rememberGroup(storage, '')

    expect(rememberedGroup(storage)).toBe('')
  })
})

describe('rememberedGroup', () => {
  it('remembers nothing before anything has been chosen', () => {
    expect(rememberedGroup(memoryStorage())).toBe('')
  })
})
