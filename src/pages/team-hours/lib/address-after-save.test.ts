import { describe, expect, it } from 'vitest'

import type { Team } from '@/entities/teams'

import { addressAfterSave } from './address-after-save'

function team(id: string): Team {
  return { id, members: [], name: `Team ${id}`, updatedAt: '2026-05-01T00:00:00.000Z' }
}

const A = team('018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d70')
const B = team('018f3b2c-7a41-7c9e-9f2d-5b1a4e6c8d71')

describe('addressAfterSave', () => {
  it('leaves an address naming a team that is still there', () => {
    expect(addressAfterSave([A, B], A.id)).toBeNull()
  })

  it('leaves an address that names none', () => {
    expect(addressAfterSave([A], '')).toBeNull()
  })

  // The reported bug: the team the report was about is deleted, and the address
  // keeps naming it. The screen then says it is not one of theirs — about the
  // team they just removed — and the picker's trigger draws empty.
  it('moves to a team that is there when the addressed one was deleted', () => {
    expect(addressAfterSave([B], A.id)).toBe(B.id)
  })

  /*
   * The other way in, and the one the reader described: the address already
   * named a team they no longer have — from an earlier visit, through the
   * remembered identifier — and the first team they make is the save that
   * settles it.
   */
  it('moves to the team a reader with none has just made', () => {
    expect(addressAfterSave([B], A.id)).toBe(B.id)
  })

  // Deleting the last team. An address naming none is what invites them to make
  // one, so an empty string is the answer rather than the absence of one.
  it('names none when nothing is left', () => {
    expect(addressAfterSave([], A.id)).toBe('')
  })
})
