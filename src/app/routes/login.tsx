import { createFileRoute } from '@tanstack/react-router'

import { LoginPage } from '@/pages/login'

export const Route = createFileRoute('/login')({
  component: LoginRoute,
  validateSearch: (search: Record<string, unknown>): { next: string } => ({
    next: typeof search['next'] === 'string' ? search['next'] : '/',
  }),
})

function LoginRoute() {
  const { next } = Route.useSearch()

  return <LoginPage destination={next} />
}
