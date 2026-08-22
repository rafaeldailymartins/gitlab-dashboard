import type { AuthFailure } from '@/entities/sessions'

import { m } from '@/shared/i18n'
import { cn } from '@/shared/lib/utils'
import { buttonVariants } from '@/shared/ui/button'

/** Each failure gets its own words: "you declined" is not "GitLab is down". */
const EXPLANATIONS: Record<AuthFailure['kind'], () => string> = {
  denied: m.sign_in_failed_denied,
  'expired-session': m.sign_in_failed_expired,
  'not-configured': m.not_configured_description,
  'provider-unavailable': m.sign_in_failed_unavailable,
  'state-mismatch': m.sign_in_failed_state_mismatch,
}

export function FailureNotice({ failure }: { readonly failure: AuthFailure }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{m.sign_in_failed_title()}</h1>
      <p className="text-sm text-muted-foreground">{EXPLANATIONS[failure.kind]()}</p>
      {/* A real link, so retrying reloads the page. After a failed exchange that
          is the point: nothing half-finished carries over. It is styled as a
          button rather than rendered through one, because it navigates. */}
      <a className={cn(buttonVariants(), 'self-start')} href="/login">
        {m.sign_in_retry()}
      </a>
    </main>
  )
}
