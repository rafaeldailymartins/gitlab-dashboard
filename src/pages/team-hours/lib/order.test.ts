import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, CAMILA, member } from '~tests/support/gitlab-team-timelogs'

import type { GridRow, Member, MemberIdentity } from '@/entities/team-timelogs'

import { DEFAULT_ORDER, nextOrder, ordered } from './order'

const HOUR = 3600

interface RowOptions {
  /** What the provider said, when it resolved them at all. */
  readonly identity?: MemberIdentity
  /** What the reader stored, which is all a row has when it did not. */
  readonly saved: Member
  readonly seconds?: number
}

/** Handles, not names: a row is identified here by the one thing no ordering reads. */
function handlesOf(rows: readonly GridRow[]): readonly string[] {
  return rows.map((one) => one.member.username)
}

/** A row carrying only what an ordering reads: the two names and the total. */
function row({ identity = { kind: 'unresolved' }, saved, seconds = 0 }: RowOptions): GridRow {
  return {
    cells: [],
    identity,
    member: saved,
    placed: null,
    settled: true,
    shortfall: null,
    total: { entryCount: seconds === 0 ? 0 : 1, hours: seconds / HOUR, seconds },
  }
}

/**
 * Ana under a stale stored name.
 *
 * The two names disagree on purpose, and they disagree across the alphabet: an
 * ordering that read the stored one would put this row last where the table
 * shows it first.
 */
const ANA_RENAMED = row({
  identity: { kind: 'confirmed', person: ANA },
  saved: { ...member(ANA), name: 'Zuleica Prior' },
  seconds: 2 * HOUR,
})

const BRUNO_ROW = row({
  identity: { kind: 'confirmed', person: BRUNO },
  saved: member(BRUNO),
  seconds: 9 * HOUR,
})

/** Nothing came back for her, so the row has only what the reader stored. */
const CAMILA_UNRESOLVED = row({ saved: { ...member(CAMILA), name: 'Alice Antunes' } })

describe('nextOrder', () => {
  it('reverses the heading that is already ordering the rows', () => {
    expect(nextOrder({ by: 'person', descending: false }, 'person')).toEqual({
      by: 'person',
      descending: true,
    })
  })

  it('opens totals descending, because the question is who logged most', () => {
    expect(nextOrder(DEFAULT_ORDER, 'total')).toEqual({ by: 'total', descending: true })
  })

  it('answers the opposite question on a second turn of the same heading', () => {
    expect(nextOrder({ by: 'total', descending: true }, 'total')).toEqual({
      by: 'total',
      descending: false,
    })
  })

  it('starts a different heading afresh rather than carrying the direction over', () => {
    expect(nextOrder({ by: 'total', descending: true }, 'person')).toEqual({
      by: 'person',
      descending: false,
    })
  })
})

describe('ordered', () => {
  it('orders by the name the table shows, not by the one the reader stored', () => {
    expect(handlesOf(ordered([BRUNO_ROW, ANA_RENAMED], DEFAULT_ORDER))).toEqual([
      ANA.username,
      BRUNO.username,
    ])
  })

  it('orders somebody the provider would not resolve by the stored name, all they have', () => {
    expect(handlesOf(ordered([BRUNO_ROW, CAMILA_UNRESOLVED], DEFAULT_ORDER))).toEqual([
      CAMILA.username,
      BRUNO.username,
    ])
  })

  it('reverses the names when the heading is turned', () => {
    const reversed = ordered([ANA_RENAMED, BRUNO_ROW], { by: 'person', descending: true })

    expect(handlesOf(reversed)).toEqual([BRUNO.username, ANA.username])
  })

  it('orders by what a month came to, when the totals are the heading', () => {
    const rows = ordered([BRUNO_ROW, ANA_RENAMED], { by: 'total', descending: false })

    expect(handlesOf(rows)).toEqual([ANA.username, BRUNO.username])
  })

  it('puts the longest month first once the totals are descending', () => {
    const rows = ordered([ANA_RENAMED, BRUNO_ROW], { by: 'total', descending: true })

    expect(handlesOf(rows)).toEqual([BRUNO.username, ANA.username])
  })

  it('leaves the rows it was handed alone, rather than reordering the grid under them', () => {
    const rows = [BRUNO_ROW, ANA_RENAMED]

    ordered(rows, { by: 'total', descending: true })

    expect(handlesOf(rows)).toEqual([BRUNO.username, ANA.username])
  })
})
