import { createFileRoute, useRouter } from '@tanstack/react-router'

import { AuthCallbackPage } from '@/pages/auth-callback'

interface CallbackSearch {
  readonly code: null | string
  readonly error: null | string
  readonly state: null | string
}

function asString(value: unknown): null | string {
  return typeof value === 'string' ? value : null
}

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackRoute,
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: asString(search['code']),
    error: asString(search['error']),
    state: asString(search['state']),
  }),
})

function AuthCallbackRoute() {
  const { code, error, state } = Route.useSearch()
  const router = useRouter()

  return (
    <AuthCallbackPage
      code={code}
      error={error}
      onSignedIn={(destination) => {
        // `replace`, so the back button does not return to a callback whose
        // authorization code has already been consumed.
        router.history.replace(destination)
      }}
      state={state}
    />
  )
}
