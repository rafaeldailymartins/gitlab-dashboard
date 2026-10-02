/**
 * The three values fault reporting is built with, defined by `vite.config.ts`
 * on every build — empty when unset, never missing — so a build without a
 * project compiles the reporting code out rather than shipping it switched off.
 */
interface ImportMetaEnv {
  /** The project reports are for. Public by design, like the OAuth client id. */
  readonly VITE_SENTRY_DSN: string
  /** `production`, `staging`, `preview`, `development` or `unknown`. */
  readonly VITE_SENTRY_ENVIRONMENT: string
  /** The commit this bundle was built from, or empty outside a Netlify build. */
  readonly VITE_SENTRY_RELEASE: string
}
