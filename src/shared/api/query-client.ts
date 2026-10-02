import { QueryCache, QueryClient } from '@tanstack/react-query'

import type { Fault } from './fault'

import { faultOf } from './fault'
import { GraphQLRequestError } from './graphql'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/** Long enough that moving between screens costs nothing, short enough to be current. */
const STALE_TIME = 5 * MINUTE

/**
 * A day. The cache is the first paint on a return visit, so it has to outlive
 * the tab it was filled in.
 */
const CACHE_TIME = 24 * HOUR

const MAX_RETRIES = 2

export interface QueryClientOptions {
  /** Told of a query that failed for good, when the failure is a fault (OBS-1). */
  readonly onFault?: (fault: Fault) => void
}

export function createQueryClient(options?: QueryClientOptions): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: CACHE_TIME,
        retry: shouldRetry,
        staleTime: STALE_TIME,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        const fault = query.meta?.['reportFaults'] === false ? null : faultOf(error)

        if (fault !== null) {
          options?.onFault?.(fault)
        }
      },
    }),
  })
}

/**
 * Retries a request that could plausibly succeed next time, and only that.
 *
 * A rejected credential will be rejected again — renewal has already been tried
 * once inside the client — and a payload GitLab refused to answer will be
 * refused again. Retrying either wastes the reader's time and hides the reason.
 */
function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof GraphQLRequestError && error.failure.kind !== 'unavailable') {
    return false
  }

  return failureCount < MAX_RETRIES
}
