import { describe, expect, it, vi } from 'vitest'
import { ANA, BRUNO, member, SQUAD_FISCAL } from '~tests/support/gitlab-team-timelogs'

import { isoDate } from '@/shared/lib/date'

import type {
  ColumnProbeAnswer,
  ColumnProbeQuery,
  MemberHours,
  TeamHoursPage,
  TeamTimelogGateway,
} from '../model/ports'
import type { Person } from '../model/types'
import type { HoursRequest } from './queries'

import { readerWindow } from '../model/window'
import * as queries from './queries'

const { teamColumnsQuery, teamHoursQuery } = queries

const MONTH = isoDate('2026-05-01')
const WINDOW = readerWindow(MONTH)
const TEAM = [member(ANA), member(BRUNO)]

const NOTHING_DECLARED: ColumnProbeAnswer = {
  byColumn: new Map(),
  period: { entryCount: 0, seconds: 0 },
}

const NO_ROUND: TeamHoursPage = { members: [] }

const PROBE: ColumnProbeQuery = {
  columns: [
    { from: '2026-05-04T03:00:00.000Z', key: '2026-05-04', to: '2026-05-05T02:59:59.999999Z' },
    { from: '2026-05-05T03:00:00.000Z', key: '2026-05-05', to: '2026-05-06T02:59:59.999999Z' },
  ],
  from: '2026-05-04T03:00:00.000Z',
  groupId: null,
  memberId: ANA.id,
  to: '2026-05-06T02:59:59.999999Z',
}

/**
 * Every builder this file exports, with arguments it accepts.
 *
 * A table rather than a loop over the module alone, because each builder takes
 * a different second argument. Its keys are checked against the module's own
 * exports, so a builder added later fails here until it is listed — which makes
 * `persist: false` a property of the file, not of the two somebody remembered.
 */
const BUILDERS: Record<string, () => { meta?: Record<string, unknown> }> = {
  teamColumnsQuery: () => teamColumnsQuery(fakeGateway(), PROBE),
  teamHoursQuery: () => teamHoursQuery(fakeGateway(), hoursRequest()),
}

function fakeGateway() {
  return {
    columns: vi.fn(() => Promise.resolve(NOTHING_DECLARED)),
    following: vi.fn(() => Promise.resolve(NO_ROUND)),
    group: vi.fn(() => Promise.resolve(null)),
    groups: vi.fn(() => Promise.resolve([])),
    people: vi.fn(() => Promise.resolve([])),
    suggestions: vi.fn(() => Promise.resolve({ partial: false, people: [] })),
    timelogs: vi.fn(() => Promise.resolve(NO_ROUND)),
  } satisfies TeamTimelogGateway
}

function hoursKey(overrides: Partial<HoursRequest> = {}) {
  return teamHoursQuery(fakeGateway(), hoursRequest(overrides)).queryKey
}

function hoursRequest(overrides: Partial<HoursRequest> = {}): HoursRequest {
  return { groupId: null, members: TEAM, month: MONTH, window: WINDOW, ...overrides }
}

/** One person's round, carrying no entries, so only `nextCursor` can decide. */
function round(person: Person, nextCursor: null | string): MemberHours {
  return { declared: null, entries: [], nextCursor, person }
}

/** The query's own function, once the compiler has been shown it is not `skipToken`. */
function roundOf(options: ReturnType<typeof teamHoursQuery>) {
  const { queryFn } = options

  if (typeof queryFn !== 'function') {
    throw new TypeError('The query has no function to run')
  }

  return queryFn
}

/** The collation is stated here for the same reason the key states its own. */
function sorted(names: string[]): string[] {
  return names.toSorted((left, right) => left.localeCompare(right, 'en'))
}

describe('the report queries', () => {
  it('keeps every answer in this file off the device', () => {
    expect(sorted(Object.keys(BUILDERS))).toEqual(sorted(Object.keys(queries)))

    for (const build of Object.values(BUILDERS)) {
      expect(build().meta).toEqual({ persist: false })
    }
  })
})

describe('teamHoursQuery', () => {
  it('keys a month by the filter and the team, because each changes every figure', () => {
    expect(hoursKey({ groupId: SQUAD_FISCAL.id })).toEqual([
      'team-timelogs',
      'hours',
      MONTH,
      SQUAD_FISCAL.id,
      [ANA.id, BRUNO.id],
    ])
  })

  it('asks the same question when the same people arrive in another order', () => {
    expect(hoursKey({ members: TEAM.toReversed() })).toEqual(hoursKey())
  })

  it('asks a different question once the report is narrowed to a group', () => {
    expect(hoursKey({ groupId: SQUAD_FISCAL.id })).not.toEqual(hoursKey())
  })

  it('opens the reading with everybody, over the widened window', async () => {
    const gateway = fakeGateway()
    const { signal } = new AbortController()
    const options = teamHoursQuery(gateway, hoursRequest())

    expect(options.initialPageParam).toBeNull()

    await roundOf(options)({ pageParam: options.initialPageParam, signal } as never)

    expect(gateway.timelogs).toHaveBeenCalledWith(
      { from: WINDOW.from, groupId: null, members: TEAM, to: WINDOW.to },
      signal,
    )
    expect(gateway.following).not.toHaveBeenCalled()
  })

  it('continues only whoever is unfinished once a round hands it cursors', async () => {
    const gateway = fakeGateway()
    const { signal } = new AbortController()
    const cursors = [{ cursor: 'after-ana', memberId: ANA.id }]

    await roundOf(teamHoursQuery(gateway, hoursRequest()))({ pageParam: cursors, signal } as never)

    expect(gateway.following).toHaveBeenCalledWith(
      { cursors, from: WINDOW.from, groupId: null, to: WINDOW.to },
      signal,
    )
    expect(gateway.timelogs).not.toHaveBeenCalled()
  })

  it('reads the next round from nextCursor alone, not from whether entries arrived', () => {
    const { getNextPageParam } = teamHoursQuery(fakeGateway(), hoursRequest())
    const members = [round(ANA, 'after-ana'), round(BRUNO, null)]

    expect(getNextPageParam({ members }, [], null, [])).toEqual([
      { cursor: 'after-ana', memberId: ANA.id },
    ])
  })

  it('stops once nobody has anything after them', () => {
    const { getNextPageParam } = teamHoursQuery(fakeGateway(), hoursRequest())
    const members = [round(ANA, null), round(BRUNO, null)]

    expect(getNextPageParam({ members }, [], null, [])).toBeNull()
  })

  it('does not refetch on focus, which for an infinite query re-runs every round', () => {
    expect(teamHoursQuery(fakeGateway(), hoursRequest()).refetchOnWindowFocus).toBe(false)
  })
})

describe('teamColumnsQuery', () => {
  it('keys a probe by the person, the filter and the spans, never by the month', () => {
    const key = teamColumnsQuery(fakeGateway(), PROBE).queryKey

    expect(key).toEqual(['team-timelogs', 'columns', ANA.id, null, PROBE.from, PROBE.to, 2])
    expect(key).not.toContain(MONTH)
  })

  it('asks again when the same period is cut into a different number of columns', () => {
    const fewer = { ...PROBE, columns: PROBE.columns.slice(0, 1) }

    expect(teamColumnsQuery(fakeGateway(), fewer).queryKey).not.toEqual(
      teamColumnsQuery(fakeGateway(), PROBE).queryKey,
    )
  })

  it('is collected briefly, because the placement it feeds is read once', () => {
    const probe = teamColumnsQuery(fakeGateway(), PROBE)

    expect(probe.gcTime).toBe(60_000)
    expect(probe.gcTime).toBeLessThan(teamHoursQuery(fakeGateway(), hoursRequest()).gcTime ?? 0)
  })
})
