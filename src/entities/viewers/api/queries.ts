import { queryOptions } from '@tanstack/react-query'

import type { ViewerGateway } from '../model/ports'

const VIEWER_KEY = ['viewer', 'me'] as const

/**
 * A name does not change while someone is reading their hours, so this one is
 * never refetched on its own account: it is stale after a day, and the persisted
 * cache means a return visit greets the reader before any request goes out.
 */
const A_DAY = 24 * 60 * 60 * 1000

export function viewerQuery(gateway: ViewerGateway) {
  return queryOptions({
    queryFn: ({ signal }) => gateway.me(signal),
    queryKey: VIEWER_KEY,
    staleTime: A_DAY,
  })
}
