import { type GraphQLClient, GraphQLRequestError } from '@/shared/api'

import type { TimelogGateway, TimelogPage } from '../model/ports'
import type { TimelogEntry } from '../model/types'
import type { RecoveredTimelogsPayload, TimelogsPayload } from './schemas'

import { recoveredEntries } from '../model/reconcile'
import { recoveredTimelogsPayloadSchema, timelogsPayloadSchema, toTimelogEntry } from './schemas'

/**
 * A hundred entries is roughly a season of one person's logging, so the first
 * page covers every period the dashboard summarises while staying small enough
 * to parse without a visible pause.
 */
const PAGE_SIZE = 100

/**
 * No `startDate` or `endDate`.
 *
 * Verified against gitlab.com: those arguments are truncated to UTC calendar
 * dates, so `2026-08-20T16:00:00Z` still matches an entry recorded at
 * `2026-08-20T15:00:00Z`. A period asked of GitLab would therefore be a window
 * of UTC days, which is not the window the reader sees. Reading newest first and
 * cutting periods locally is both exact and fewer requests.
 */
const MY_TIMELOGS = `
  query MyTimelogs($first: Int!, $after: String) {
    currentUser {
      timelogs(sort: SPENT_AT_DESC, first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          spentAt
          timeSpent
          summary
          project {
            name
            fullPath
            webUrl
          }
          issue {
            title
            webUrl
            reference(full: true)
          }
          mergeRequest {
            title
            webUrl
            reference(full: true)
          }
        }
      }
    }
  }
`

/**
 * The same query with the project left out.
 *
 * `Timelog.project` is non-nullable in GitLab's schema, so an entry whose
 * project it will not resolve for this reader arrives as `null` and takes its
 * hours with it. Not asking for the field is what lets those hours be read: the
 * resolver that failed is never reached.
 *
 * Written out rather than derived from the query above by removing lines. String
 * surgery on a query fails as a syntactically valid query asking for the wrong
 * thing, which is not a failure any test would name; two documents cost a few
 * duplicated lines and each one reads on its own.
 */
const MY_TIMELOGS_WITHOUT_PROJECT = `
  query MyTimelogs($first: Int!, $after: String) {
    currentUser {
      timelogs(sort: SPENT_AT_DESC, first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          spentAt
          timeSpent
          summary
          issue {
            title
            webUrl
            reference(full: true)
          }
          mergeRequest {
            title
            webUrl
            reference(full: true)
          }
        }
      }
    }
  }
`

/**
 * Reads the signed-in person's own timelogs from GitLab.
 *
 * The query names no group and no project: covering every project the person
 * logged time in is the point, and it is what the previous version could not do.
 *
 * A page GitLab withheld entries from is asked for a second time without the
 * project, and what comes back is reconciled against what was already read. That
 * costs one extra request, and only for a page that actually withheld something.
 */
export function gitLabTimelogGateway(client: GraphQLClient): TimelogGateway {
  return {
    async myTimelogs(query, signal) {
      const ask = async (document: string) =>
        client.request({
          query: document,
          variables: { after: query.after, first: PAGE_SIZE },
          ...(signal ? { signal } : {}),
        })

      const first = await ask(MY_TIMELOGS)
      const payload = timelogsPayloadSchema.parse(first.data)

      refuseIfNobodyWasResolved(payload, first.errors)

      const read = readOf(payload)

      if (read.withheld === 0) {
        return { entries: read.entries, nextCursor: read.nextCursor }
      }

      const answer = await ask(MY_TIMELOGS_WITHOUT_PROJECT)

      return merged(read, candidatesOf(recoveredTimelogsPayloadSchema.parse(answer.data)))
    },
  }
}

/** The entries of a recovery answer. Anything still withheld stays withheld. */
function candidatesOf(payload: RecoveredTimelogsPayload): TimelogEntry[] {
  return (payload.currentUser?.timelogs.nodes ?? [])
    .filter((node) => node !== null)
    .map((node) => toTimelogEntry(node))
}

/**
 * The page as both answers together describe it.
 *
 * `withheld` bounds what the second answer can contribute, so a page that
 * shifted between the two requests can only leave an entry unrecovered — which
 * the counts declare — and never count one twice.
 */
function merged(read: ReturnType<typeof readOf>, candidates: TimelogEntry[]): TimelogPage {
  const missing = recoveredEntries(read.entries, candidates, read.withheld)

  return {
    entries: newestFirst([...read.entries, ...missing]),
    nextCursor: read.nextCursor,
    recovered: missing.length,
    withheld: read.withheld,
  }
}

/** Newest first, which is what `TimelogPage` promises its reader. */
function newestFirst(entries: readonly TimelogEntry[]): TimelogEntry[] {
  return entries.toSorted((left, right) => right.spentAt.getTime() - left.spentAt.getTime())
}

/**
 * What one answer says: the entries in it, how many it withheld, and where the
 * next page starts.
 *
 * A null `currentUser` means GitLab accepted the token but resolved no person
 * behind it. There is no report to show, and it is not a failure of ours.
 */
function readOf(payload: TimelogsPayload) {
  const timelogs = payload.currentUser?.timelogs

  if (!timelogs) {
    return { entries: [], nextCursor: null, withheld: 0 }
  }

  const present = timelogs.nodes.filter((node) => node !== null)

  return {
    entries: present.map((node) => toTimelogEntry(node)),
    nextCursor: timelogs.pageInfo.hasNextPage ? timelogs.pageInfo.endCursor : null,
    withheld: timelogs.nodes.length - present.length,
  }
}

/**
 * A null person with errors beside it is a refusal, not an empty history.
 *
 * With no errors, a null `currentUser` means GitLab accepted the token and
 * resolved nobody behind it, and an empty report is the truth. With errors,
 * something GitLab could not resolve took the whole person with it — and telling
 * the reader they logged no hours, as a fact, is the worst answer available.
 */
function refuseIfNobodyWasResolved(payload: TimelogsPayload, errors: readonly string[]): void {
  if (payload.currentUser === null && errors.length > 0) {
    throw new GraphQLRequestError({ kind: 'rejected', messages: errors })
  }
}
