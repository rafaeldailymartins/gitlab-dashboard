import { useState } from 'react'

import { useSession } from '@/entities/sessions'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

interface LoginPageProps {
  /** Where to land after signing in, so a deep link is not lost. */
  readonly destination: string
}

export function LoginPage({ destination }: LoginPageProps) {
  const { signIn } = useSession()
  const [isStarting, setIsStarting] = useState(false)

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{m.sign_in_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.sign_in_description()}</p>
      </header>

      <Button
        disabled={isStarting}
        onClick={() => {
          setIsStarting(true)
          void signIn(destination)
        }}
        size="lg"
        type="button"
      >
        {m.sign_in_action()}
      </Button>

      <p className="text-xs text-muted-foreground">{m.sign_in_no_token_notice()}</p>
    </main>
  )
}
