import type { Config } from '@netlify/functions'

import { envelopeTunnel } from '../lib/envelope-tunnel.mjs'

/**
 * The fault-reporting tunnel (OBS-4).
 *
 * Everything worth testing is one module down, in `envelope-tunnel.mts`: which
 * project it forwards to, which items it keeps, which headers it drops. This
 * file names the project and the path.
 *
 * The project comes from `VITE_SENTRY_DSN`, the variable the bundle is built
 * with, under the same name — as `gitlab.mts` reads the GitLab variables — so a
 * deploy has one setting for reporting and not two that could disagree. Without
 * it the tunnel answers `404` and forwards nothing.
 *
 * No `rateLimit` here, and on purpose: the plan this site runs on offers none
 * (see `handle-document.mts`), and a limit the platform silently ignores is
 * worse than none, because it reads as a control. What bounds this endpoint is
 * that every refusal happens before a request leaves it, and that the browser
 * stops sending after a handful of reports per page.
 */
export default envelopeTunnel({
  dsn: process.env['VITE_SENTRY_DSN'],
  fetch: (input, init) => fetch(input, init),
})

export const config: Config = { path: '/.netlify/functions/monitor' }
