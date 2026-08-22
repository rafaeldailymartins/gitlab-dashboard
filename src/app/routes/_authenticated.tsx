import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { hasSession } from '@/app/lib/session'

/**
 * Everything behind a session hangs off this layout, so the check lives in one
 * place rather than being repeated — and forgotten — on each new route.
 *
 * The address the reader asked for travels along as `next`, so a deep link
 * survives the round trip to GitLab.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!hasSession()) {
      // TanStack Router signals a redirect by throwing its own marker object,
      // which is not an Error. That is the documented API, not a mistake.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ search: { next: location.href }, to: '/login' })
    }
  },
  component: Outlet,
})
