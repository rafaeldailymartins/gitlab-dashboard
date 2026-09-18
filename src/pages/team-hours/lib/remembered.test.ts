import { describe, expect, it } from 'vitest'

import { memoryStorage } from '@/shared/lib/storage'

import { rememberedTeam, rememberTeam } from './remembered'

const TEAM = '018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70'

describe('rememberTeam', () => {
  it('brings the choice back on the next visit', () => {
    const storage = memoryStorage()

    rememberTeam(storage, TEAM)

    expect(rememberedTeam(storage)).toBe(TEAM)
  })

  it('forgets it when the choice is cleared', () => {
    const storage = memoryStorage()

    rememberTeam(storage, TEAM)
    rememberTeam(storage, '')

    expect(rememberedTeam(storage)).toBe('')
  })
})

describe('rememberedTeam', () => {
  it('remembers nothing before anything has been chosen', () => {
    expect(rememberedTeam(memoryStorage())).toBe('')
  })
})
