import { useState } from 'react'

import { useSession } from '@/entities/sessions'
import { ThemeToggle } from '@/features/theme'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { Wordmark } from '@/shared/ui/wordmark'

import { FeedArt } from './feed-art'
import { GitLabMark } from './gitlab-mark'

interface LoginPageProps {
  /** Where to land after signing in, so a deep link is not lost. */
  readonly destination: string
}

/**
 * The sign-in screen is one button. What surrounds it says what the reader is
 * signing in to — the mark, the product's claim, and the shape of what waits on
 * the other side — and then which account it wants.
 *
 * Nothing here explains the authority the application asks for. The button names
 * GitLab, GitLab's own consent screen states the scope in GitLab's words, and a
 * paragraph repeating it in ours only pushed the button down the page.
 *
 * "Sign in" is the level-1 heading and is set as a kicker rather than as the
 * largest thing on the screen. It names the screen for anyone arriving by
 * heading, which is what an h1 is for; the line below it is what the eye reads
 * first, which is what a claim is for.
 */
export function LoginPage({ destination }: LoginPageProps) {
  const { signIn } = useSession()
  const [status, setStatus] = useState<'failed' | 'idle' | 'starting'>('idle')

  return (
    <main className="relative grid flex-1 grid-cols-1 lg:grid-cols-2">
      {/* Tight on a phone, where the two panels stack and the button has to stay
          within the first screenful. */}
      <div className="flex flex-col gap-10 border-b bg-card px-6 py-10 sm:gap-12 sm:px-10 lg:border-r lg:border-b-0 lg:px-14 lg:py-16">
        <Wordmark />
        <div className="flex flex-col justify-center gap-10 lg:flex-1">
          <p className="max-w-sm text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {m.sign_in_headline()}
          </p>
          <FeedArt />
        </div>
      </div>

      <div className="flex flex-col justify-center gap-6 px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="flex flex-col gap-3">
          <h1 className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            {m.sign_in_title()}
          </h1>
          <p className="max-w-md text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {m.sign_in_lead()}
          </p>
        </div>
        <Button
          className="h-11 w-full max-w-md text-base"
          disabled={status === 'starting'}
          onClick={() => {
            setStatus('starting')
            /* Nothing here is allowed to end in a disabled button and no
               explanation. Getting as far as GitLab needs `crypto.subtle`, a
               storage write and a URL built from configuration, and any of the
               three can refuse — after which the reader's only control would sit
               dimmed with nothing said, on a screen that has no header to escape
               through. */
            void signIn(destination).catch(() => {
              setStatus('failed')
            })
          }}
          size="lg"
          type="button"
        >
          <GitLabMark />
          {m.sign_in_action()}
        </Button>
        {status === 'failed' ? (
          <p className="max-w-md text-sm text-destructive" role="alert">
            {m.sign_in_failed_unavailable()}
          </p>
        ) : null}
      </div>

      {/* Last in the document so the first Tab lands on the button this screen
          exists for. A corner utility is not the primary action. */}
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
    </main>
  )
}
