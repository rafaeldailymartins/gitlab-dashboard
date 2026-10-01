import { createRouter } from '@tanstack/react-router'

import { routeTree } from '@/app/routeTree.gen'
import { NotFoundPage } from '@/pages/not-found'

export const router = createRouter({
  defaultNotFoundComponent: NotFoundPage,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  routeTree,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
