import { describe, expect, it } from 'vitest'

import { TEAM_HOURS_PAGE, teamColumnProbe, teamHoursFollowing } from './documents'
import { GROUP_SUGGESTIONS, MY_GROUPS, PEOPLE_SEARCH } from './suggestion-documents'

/**
 * Every document this slice sends, named so a new one cannot be added quietly.
 *
 * The two builders are called with a small count rather than none: a builder
 * asked for zero aliases produces a document with no period arguments at all,
 * which would pass every check below while proving nothing.
 */
const DOCUMENTS: readonly { document: string; name: string }[] = [
  { document: TEAM_HOURS_PAGE, name: 'TeamHoursPage' },
  { document: teamHoursFollowing(2), name: 'TeamHoursFollowing' },
  { document: teamColumnProbe(3), name: 'TeamColumnProbe' },
  { document: GROUP_SUGGESTIONS, name: 'GroupSuggestions' },
]

/** The two that read no period at all, and must keep reading none. */
const PERIODLESS: readonly { document: string; name: string }[] = [
  { document: MY_GROUPS, name: 'MyGroups' },
  { document: PEOPLE_SEARCH, name: 'PeopleSearch' },
]

describe('every document that asks about a period', () => {
  it.each(DOCUMENTS)('asks $name for an instant range', ({ document }) => {
    expect(document).toContain('startTime:')
    expect(document).toContain('endTime:')
  })

  it.each(DOCUMENTS)('never asks $name for a calendar date', ({ document }) => {
    // `TimelogResolver#parse_datetime_args` truncates `startDate`/`endDate` to
    // whole UTC days with `beginning_of_day`, verified against the real
    // provider: an entry recorded at 15:00:00Z still matches
    // `startDate: 2026-08-20T16:00:00Z`. A period asked that way is a window of
    // UTC days, and its totals disagree with the days on screen by whatever was
    // logged on the boundary days.
    expect(document).not.toContain('startDate')
    expect(document).not.toContain('endDate')
  })

  it.each(DOCUMENTS)('never pairs a start instant with an end date in $name', ({ document }) => {
    // `validate_args!` PERMITS that pair and then truncates one end only, so the
    // window is silently asymmetric — the failure mode with no error attached to
    // it, and the reason this is asserted rather than assumed.
    expect(/startTime[\S\s]*endDate/u.test(document)).toBe(false)
    expect(/startDate[\S\s]*endTime/u.test(document)).toBe(false)
  })
})

describe('the documents that ask about no period', () => {
  it.each(PERIODLESS)('asks $name for no range of any kind', ({ document }) => {
    // A picker answers about groups and people, not about hours. A period here
    // would be an argument the answer does not depend on, and the next reader
    // would have to work out which.
    for (const argument of ['startTime', 'endTime', 'startDate', 'endDate']) {
      expect(document).not.toContain(argument)
    }
  })
})
