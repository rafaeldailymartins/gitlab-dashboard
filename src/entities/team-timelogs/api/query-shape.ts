/**
 * What every query in this slice shares.
 *
 * Here rather than in `queries.ts` because the report's queries and the
 * pickers' are in two files and would otherwise each carry their own copy —
 * and `persist: false` is a rule, not a default: a second copy of it is a second
 * place it can be forgotten.
 */

/**
 * Marks every answer in this slice as one that must not reach the device.
 *
 * These hours belong to people other than the reader, and a shared or borrowed
 * machine would otherwise show them to whoever opens the app next. It travels on
 * the query rather than as a key the persister has to recognise, so the rule
 * lives with the thing it is about and nothing else has to import it.
 *
 * It covers the team's names as much as its figures: a roster is a list of
 * colleagues, and writing one to IndexedDB is the same leak by a quieter route.
 */
export const NOT_PERSISTED = { persist: false }

export const TEAM_TIMELOGS_KEY = 'team-timelogs'

const MINUTE = 60 * 1000

/** A month that has ended does not change; one in progress changes slowly. */
export const STALE_TIME = 5 * MINUTE

export const GC_TIME = 30 * MINUTE

/** Short enough that a month of answers per person is not held after a move on. */
export const BRIEFLY = MINUTE
