import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { m } from '@/shared/i18n'

/**
 * What an address that names no screen is answered with.
 *
 * The router's own answer is a bare "Not Found" in English whatever language the
 * reader chose, which is the one string in the app no catalogue could reach. An
 * address can be old — `/teams` was a screen before the teams became a dialog
 * over the report — so this says so plainly and offers the way back, rather than
 * guessing which screen was meant.
 */
export function NotFoundPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{m.not_found_title()}</h1>
      <p className="text-sm text-muted-foreground">{m.not_found_description()}</p>
      <Link
        className="flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        to="/"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {m.not_found_back()}
      </Link>
    </main>
  )
}
