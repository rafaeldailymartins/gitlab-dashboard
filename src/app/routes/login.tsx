import { createFileRoute, redirect } from '@tanstack/react-router'

import { hasSession } from '@/app/lib/runtime'
import { LoginPage } from '@/pages/login'

/**
 * Where the reader was heading, as it arrives in the address bar.
 *
 * Anything that is not a path on this origin is discarded rather than trusted. It
 * reaches `navigate` and `history`, and this value comes from a link someone else
 * may have written: `//elsewhere.example` is a protocol-relative URL, not a path.
 */
function destinationFrom(search: Record<string, unknown>): string {
  const next = search['next']

  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export const Route = createFileRoute('/login')({
  /**
   * A reader who already has a session has nothing to do here, and the screen
   * carries its own colour-scheme control — so letting them stay would put two
   * identical controls on the page, one in the header and one below the button.
   * They go where they were heading, not to the default screen: this route is
   * also where a stale link lands, and it already knows the answer.
   */
  beforeLoad: ({ search }) => {
    if (hasSession()) {
      // TanStack Router signals a redirect by throwing its own marker object,
      // which is not an Error. That is the documented API, not a mistake.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ href: search.next })
    }
  },
  component: LoginRoute,
  validateSearch: (search: Record<string, unknown>): { next: string } => ({
    next: destinationFrom(search),
  }),
})

function LoginRoute() {
  const { next } = Route.useSearch()

  return <LoginPage destination={next} />
}
