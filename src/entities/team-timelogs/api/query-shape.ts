/**
 * What every query in this slice shares.
 *
 * Here rather than in `queries.ts` because the report's queries and the
 * pickers' are in two files and would otherwise each carry their own copy.
 * `NOT_PERSISTED`, which every one of them carries, is in `shared/api` for the
 * same reason one level up: `entities/teams` carries it too.
 */

export const TEAM_TIMELOGS_KEY = 'team-timelogs'

const MINUTE = 60 * 1000

/** A month that has ended does not change; one in progress changes slowly. */
export const STALE_TIME = 5 * MINUTE

export const GC_TIME = 30 * MINUTE

/** Short enough that a month of answers per person is not held after a move on. */
export const BRIEFLY = MINUTE
