import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router'

import { appCachePersister } from '@/app/lib/query'
import { hasSession } from '@/app/lib/runtime'
import { useSession } from '@/entities/sessions'
import { ThemeToggle } from '@/features/theme'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { Wordmark } from '@/shared/ui/wordmark'

const NAVIGATION_LINK_CLASS =
  'rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:font-medium aria-[current=page]:text-foreground'

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
  component: AuthenticatedLayout,
})

/**
 * The chrome of a signed-in session: the mark, the navigation, the colour scheme
 * and the way out.
 *
 * It lives in this file rather than in the root, so that the guard above is the
 * same thing that decides the header exists. Gating it on React state let the two
 * disagree: a refresh token GitLab refuses clears the store without telling
 * React, and the reader would get the sign-in screen underneath a full signed-in
 * header.
 */
function AuthenticatedLayout() {
  const { signOut } = useSession()
  const client = useQueryClient()
  const navigate = useNavigate()

  return (
    <>
      <header className="border-b">
        {/* Wraps rather than overflowing: at 375 pixels the brand and the two
            controls fill the first row and the navigation takes the second,
            which itself wraps once four links no longer fit across it. */}
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Wordmark />
          <nav
            aria-label={m.nav_label()}
            className="order-last flex w-full flex-wrap items-center gap-1 sm:order-none sm:w-auto"
          >
            <Link className={NAVIGATION_LINK_CLASS} to="/">
              {m.nav_dashboard()}
            </Link>
            <Link className={NAVIGATION_LINK_CLASS} to="/insights">
              {m.nav_insights()}
            </Link>
            {/* The only link that carries search parameters, and so the only one
                that has to say to ignore them: a link is current when its search
                is a subset of the address's, and this one's empty group and month
                are filled the moment the screen opens — by the route's own
                recovery, by the remembered group, or by the reader choosing. Left
                to the default, the tab the reader is looking at would be the one
                tab never marked current. */}
            <Link
              activeOptions={{ includeSearch: false }}
              className={NAVIGATION_LINK_CLASS}
              search={{ by: 'days', group: '', month: '' }}
              to="/team"
            >
              {m.nav_team()}
            </Link>
            <Link className={NAVIGATION_LINK_CLASS} to="/settings">
              {m.nav_settings()}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button
              onClick={() => {
                void leaveFor(signOut, client, navigate)
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {m.sign_out_action()}
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </>
  )
}

/**
 * The route guard only runs on navigation, so signing out has to move the reader
 * itself — otherwise they would sit on a screen they no longer have a session
 * for. The cache goes with it, in memory and on disk, so one person's hours
 * never greet the next one on a shared device.
 *
 * `signOut` is awaited first because it is what clears the credential: clearing
 * the cache while a token still works would only invite the next render to fill
 * it again. It cannot hang — the revocation it waits on carries a timeout.
 */
async function leaveFor(
  signOut: () => Promise<void>,
  client: ReturnType<typeof useQueryClient>,
  navigate: ReturnType<typeof useNavigate>,
): Promise<void> {
  await signOut()
  client.clear()
  await appCachePersister.removeClient()
  await navigate({ search: { next: '/' }, to: '/login' })
}
