import type { GraphQLClient } from '@/shared/api'

import type { TimelogGateway, TimelogPage } from '../model/ports'

import { type TimelogsPayload, timelogsPayloadSchema, toTimelogEntry } from './schemas'

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
 * Reads the signed-in person's own timelogs from GitLab.
 *
 * The query names no group and no project: covering every project the person
 * logged time in is the point, and it is what the previous version could not do.
 */
export function gitLabTimelogGateway(client: GraphQLClient): TimelogGateway {
  return {
    async myTimelogs(query, signal) {
      const data = await client.request({
        query: MY_TIMELOGS,
        variables: { after: query.after, first: PAGE_SIZE },
        ...(signal ? { signal } : {}),
      })

      return toPage(timelogsPayloadSchema.parse(data))
    },
  }
}

function toPage(payload: TimelogsPayload): TimelogPage {
  const timelogs = payload.currentUser?.timelogs

  // A null `currentUser` means GitLab accepted the token but resolved no person
  // behind it. There is no report to show, and it is not a failure of ours.
  if (!timelogs) {
    return { entries: [], nextCursor: null }
  }

  return {
    entries: timelogs.nodes.map((node) => toTimelogEntry(node)),
    nextCursor: timelogs.pageInfo.hasNextPage ? timelogs.pageInfo.endCursor : null,
  }
}
