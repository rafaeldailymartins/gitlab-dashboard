import { createQueryClient, queryCachePersister } from '@/shared/api'

import { faults } from './monitoring'

/**
 * One cache for the page, restored from IndexedDB before the first request.
 *
 * Built at module scope, like the session manager beside it, so that everything
 * reads and writes the same cache — and so that signing out can reach the
 * persister from wherever the control happens to live.
 */
export const appQueryClient = createQueryClient({
  onFault: (fault) => {
    faults.report(fault.error, { kind: fault.kind, origin: 'query' })
  },
})

export const appCachePersister = queryCachePersister()
