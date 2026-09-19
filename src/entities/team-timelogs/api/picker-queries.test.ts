import { describe, expect, it, vi } from 'vitest'
import { ANA, SQUAD_FISCAL } from '~tests/support/gitlab-team-timelogs'

import type {
  ColumnProbeAnswer,
  SuggestionQuery,
  TeamHoursPage,
  TeamTimelogGateway,
} from '../model/ports'

import * as queries from './picker-queries'

const { groupQuery, groupSearchQuery, peopleSearchQuery, teamSuggestionsQuery } = queries

const NOTHING_DECLARED: ColumnProbeAnswer = {
  byColumn: new Map(),
  period: { entryCount: 0, seconds: 0 },
}

const NO_ROUND: TeamHoursPage = { members: [] }

const SUGGESTIONS: SuggestionQuery = {
  from: '2026-04-30T00:00:00.000Z',
  fullPath: SQUAD_FISCAL.fullPath,
  to: '2026-06-01T23:59:59.999Z',
}

/**
 * Every builder this file exports, with arguments it accepts.
 *
 * A table rather than a loop over the module alone, because each builder takes
 * a different second argument. Its keys are checked against the module's own
 * exports, so a builder added later fails here until somebody lists it — which
 * is what makes `persist: false` a property of the file rather than of the four
 * functions whoever wrote the test happened to remember. A picker leaks the
 * same thing the report does: a group's roster is a list of colleagues, and a
 * name written to IndexedDB outlives the reader who asked for it.
 */
const BUILDERS: Record<string, () => { meta?: Record<string, unknown> }> = {
  groupQuery: () => groupQuery(fakeGateway(), SQUAD_FISCAL.fullPath),
  groupSearchQuery: () => groupSearchQuery(fakeGateway(), null),
  peopleSearchQuery: () => peopleSearchQuery(fakeGateway(), 'ana'),
  teamSuggestionsQuery: () => teamSuggestionsQuery(fakeGateway(), SUGGESTIONS),
}

/**
 * The query's own function, run with a signal.
 *
 * The options type allows `skipToken` in place of a function, so it is narrowed
 * before it is called. The cast is what the narrowing cannot do on its own: a
 * value narrowed to `Function` returns `any` when called, which is exactly what
 * the type rules here forbid.
 */
function ask(options: { queryFn?: unknown }, signal: AbortSignal): unknown {
  const { queryFn } = options

  if (typeof queryFn !== 'function') {
    throw new TypeError('The query has no function to run')
  }

  const run = queryFn as (context: { signal: AbortSignal }) => unknown

  return run({ signal })
}

function fakeGateway() {
  return {
    columns: vi.fn(() => Promise.resolve(NOTHING_DECLARED)),
    following: vi.fn(() => Promise.resolve(NO_ROUND)),
    group: vi.fn(() => Promise.resolve(SQUAD_FISCAL)),
    groups: vi.fn(() => Promise.resolve([SQUAD_FISCAL])),
    people: vi.fn(() => Promise.resolve([ANA])),
    suggestions: vi.fn(() => Promise.resolve({ partial: false, people: [] })),
    timelogs: vi.fn(() => Promise.resolve(NO_ROUND)),
  } satisfies TeamTimelogGateway
}

/** The collation is stated rather than left to the machine, as the keys state theirs. */
function sorted(names: string[]): string[] {
  return names.toSorted((left, right) => left.localeCompare(right, 'en'))
}

describe('the picker queries', () => {
  it('keeps every answer in this file off the device', () => {
    expect(sorted(Object.keys(BUILDERS))).toEqual(sorted(Object.keys(queries)))

    for (const build of Object.values(BUILDERS)) {
      expect(build().meta).toEqual({ persist: false })
    }
  })
})

describe('groupQuery', () => {
  it('does not look up the empty path, which is the unnarrowed default', () => {
    expect(groupQuery(fakeGateway(), '').enabled).toBe(false)
  })

  it('resolves the group an address names, and can be cancelled', async () => {
    const gateway = fakeGateway()
    const { signal } = new AbortController()
    const options = groupQuery(gateway, SQUAD_FISCAL.fullPath)

    expect(options.enabled).toBe(true)
    expect(options.queryKey).toEqual(['team-timelogs', 'group', SQUAD_FISCAL.fullPath])

    await ask(options, signal)

    expect(gateway.group).toHaveBeenCalledWith(SQUAD_FISCAL.fullPath, signal)
  })
})

describe('groupSearchQuery', () => {
  it('lists the groups the reader may open before they have typed anything', () => {
    expect(groupSearchQuery(fakeGateway(), null).enabled).not.toBe(false)
  })

  it('keys an unfiltered listing apart from a searched one', () => {
    const all = groupSearchQuery(fakeGateway(), null).queryKey
    const searched = groupSearchQuery(fakeGateway(), 'fiscal').queryKey

    expect(all).toEqual(['team-timelogs', 'groups', null])
    expect(searched).not.toEqual(all)
  })
})

describe('peopleSearchQuery', () => {
  it('offers nobody until the reader has typed a name', () => {
    expect(peopleSearchQuery(fakeGateway(), '').enabled).toBe(false)
    expect(peopleSearchQuery(fakeGateway(), ' '.repeat(3)).enabled).toBe(false)
  })

  it('searches the provider once there is something to search for', async () => {
    const gateway = fakeGateway()
    const { signal } = new AbortController()
    const options = peopleSearchQuery(gateway, 'ana')

    expect(options.enabled).toBe(true)
    expect(options.queryKey).toEqual(['team-timelogs', 'people', 'ana'])

    await ask(options, signal)

    expect(gateway.people).toHaveBeenCalledWith('ana', signal)
  })
})

describe('teamSuggestionsQuery', () => {
  it('keys candidates by the group and the window they logged in', () => {
    const key = teamSuggestionsQuery(fakeGateway(), SUGGESTIONS).queryKey

    expect(key).toEqual([
      'team-timelogs',
      'suggestions',
      SQUAD_FISCAL.fullPath,
      SUGGESTIONS.from,
      SUGGESTIONS.to,
    ])
  })
})
