import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

import type { SessionManager } from '../api/session-manager'

export interface SessionContextValue {
  completeSignIn: (code: string, state: string) => Promise<string>
  readonly isSignedIn: boolean
  /** Sends the reader to GitLab, remembering where they were heading. */
  signIn: (destination: string) => Promise<void>
  signOut: () => Promise<void>
}

interface SessionProviderProps {
  readonly children: ReactNode
  readonly manager: SessionManager
  /** Sends the browser to another origin. Injected so a test never navigates. */
  readonly navigateAway: (url: string) => void
}

const SessionContext = createContext<null | SessionContextValue>(null)

export function SessionProvider({ children, manager, navigateAway }: SessionProviderProps) {
  const [isSignedIn, setIsSignedIn] = useState(() => manager.hasSession())

  const signIn = useCallback(
    async (destination: string) => {
      navigateAway(await manager.startSignIn(destination))
    },
    [manager, navigateAway],
  )

  const completeSignIn = useCallback(
    async (code: string, state: string) => {
      const destination = await manager.completeSignIn(code, state)
      setIsSignedIn(true)

      return destination
    },
    [manager],
  )

  const signOut = useCallback(async () => {
    // The flag flips first: whatever the provider says about revocation, the
    // reader is out as far as this app is concerned.
    setIsSignedIn(false)

    try {
      await manager.signOut()
    } catch {
      // Revocation is best effort. The local session is already gone and there
      // is nothing the reader could do about GitLab refusing the request, so
      // this must not surface as a failure — or as an unhandled rejection.
    }
  }, [manager])

  const value = useMemo(
    () => ({ completeSignIn, isSignedIn, signIn, signOut }),
    [completeSignIn, isSignedIn, signIn, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)

  if (!value) {
    throw new Error('useSession was called outside a SessionProvider')
  }

  return value
}
