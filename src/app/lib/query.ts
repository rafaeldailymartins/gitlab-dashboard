import { createQueryClient, queryCachePersister } from '@/shared/api'

/**
 * One cache for the page, restored from IndexedDB before the first request.
 *
 * Built at module scope, like the session manager beside it, so that everything
 * reads and writes the same cache — and so that signing out can reach the
 * persister from wherever the control happens to live.
 */
export const appQueryClient = createQueryClient()

export const appCachePersister = queryCachePersister()
