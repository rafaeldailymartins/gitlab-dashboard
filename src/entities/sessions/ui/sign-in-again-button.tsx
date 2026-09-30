import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

import { useSession } from './session-provider'

/**
 * Authorises once more and comes back to the address the reader is on (AUTH-11).
 *
 * For a session granted before this app asked for an identity: everything it
 * authorises still works, and a fresh authorisation carries the scope the teams
 * store needs. The notices it sits under already said "sign in again"; a sentence
 * that names an action and offers nothing to press makes the reader go looking
 * for it, and the only sign-in control in the app is behind a screen a signed-in
 * reader is redirected away from.
 *
 * It never signs out. The destination is the whole address — a team report's
 * carries the team, the month, the filter and the columns — read from the
 * document rather than from a router, so a surface that has none still knows
 * where the reader is.
 */
export function SignInAgainButton() {
  const { signIn } = useSession()

  return (
    <Button
      onClick={() => {
        const { hash, pathname, search } = globalThis.location

        signIn(`${pathname}${search}${hash}`).catch(() => {
          // Nothing was started, so nothing was lost: the session is untouched
          // and the notice that offered this is still on screen to try again.
        })
      }}
      size="lg"
      type="button"
    >
      {m.sign_in_again_action()}
    </Button>
  )
}
