import { useEffect, useState } from 'react'

import { asAuthFailure, type AuthFailure, useSession } from '@/entities/sessions'
import { m } from '@/shared/i18n'

import { FailureNotice } from './failure-notice'

interface AuthCallbackPageProps {
  readonly code: null | string
  /** GitLab's own error parameter, present when the reader declined. */
  readonly error: null | string
  readonly onSignedIn: (destination: string) => void
  readonly state: null | string
}

/**
 * Where GitLab sends the reader back to.
 *
 * The exchange runs once, because it consumes the pending request: a second
 * attempt would find nothing pending and report a mismatch.
 */
export function AuthCallbackPage({ code, error, onSignedIn, state }: AuthCallbackPageProps) {
  const { completeSignIn } = useSession()
  const [exchangeFailure, setExchangeFailure] = useState<AuthFailure | null>(null)
  const upfrontFailure = failureInAddress(code, error, state)

  useEffect(() => {
    if (upfrontFailure !== null || code === null || state === null) {
      return
    }

    let abandoned = false

    completeSignIn(code, state).then(onSignedIn, (error_: unknown) => {
      if (!abandoned) {
        setExchangeFailure(asAuthFailure(error_))
      }
    })

    return () => {
      abandoned = true
    }
  }, [code, completeSignIn, onSignedIn, state, upfrontFailure])

  const failure = upfrontFailure ?? exchangeFailure

  if (failure !== null) {
    return <FailureNotice failure={failure} />
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {m.signing_in()}
      </p>
    </main>
  )
}

/**
 * What the callback address says before anything is attempted.
 *
 * Derived rather than set in an effect: these outcomes are readable straight
 * from the URL, and an effect that sets state synchronously only costs a second
 * render.
 */
function failureInAddress(
  code: null | string,
  error: null | string,
  state: null | string,
): AuthFailure | null {
  if (error !== null) {
    return { kind: 'denied' }
  }

  return code === null || state === null ? { kind: 'state-mismatch' } : null
}
