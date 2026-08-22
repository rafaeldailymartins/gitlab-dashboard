import { m } from '@/shared/i18n'

/**
 * Shown when the build carries no OAuth application id.
 *
 * Nothing in the dashboard can work without one, so this replaces the app
 * rather than hiding behind a failed sign-in — and it says exactly what to do.
 */
export function NotConfiguredPage({ redirectUri }: { readonly redirectUri: string }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{m.not_configured_title()}</h1>
      <p className="text-sm text-muted-foreground">{m.not_configured_description()}</p>
      <ol className="ml-5 list-decimal space-y-2 text-sm text-muted-foreground">
        <li>{m.not_configured_step_create()}</li>
        <li>{m.not_configured_step_public()}</li>
        <li>{m.not_configured_step_redirect({ redirectUri })}</li>
        <li>{m.not_configured_step_env()}</li>
      </ol>
    </main>
  )
}
