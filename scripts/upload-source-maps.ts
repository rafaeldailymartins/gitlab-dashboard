/**
 * Uploads the build's source maps to the tracker, when the build may (OBS-8).
 *
 * Only Netlify's build carries `SENTRY_AUTH_TOKEN`, so a local build, CI and a
 * fork's preview skip this and say so. With a token the maps go up under the
 * release the bundle names — the commit — and `drop-source-maps.ts` deletes
 * them straight after, so they are uploaded and never served.
 *
 * **No debug IDs.** `@sentry/vite-plugin` would inject a snippet into every
 * chunk to carry one, and that cost 3.26 kB of gzip on an initial load with 1.8
 * kB to spare. A map is matched by its release and its file name instead: the
 * chunks name no map (`build.sourcemap: 'hidden'`), and `sentry-cli` pairs
 * `index-abc.js` with `index-abc.js.map` beside it on its own. What that loses
 * is a match that survives a file being renamed after the build, which nothing
 * here does.
 *
 * The organisation and project come from `SENTRY_ORG` and `SENTRY_PROJECT`,
 * which the CLI reads itself.
 */
import { SentryCli } from '@sentry/cli'

const token = process.env['SENTRY_AUTH_TOKEN']?.trim() ?? ''
const release = process.env['COMMIT_REF']?.trim() ?? ''

if (token === '') {
  process.stdout.write('No SENTRY_AUTH_TOKEN: source maps are not uploaded from this build\n')
} else if (release === '') {
  // A map uploaded under no release matches no report. Failing is the only
  // answer that is noticed before somebody needs a readable stack.
  throw new Error('SENTRY_AUTH_TOKEN is set but COMMIT_REF is not: nothing to name the release')
} else {
  await new SentryCli(null, {}).execute(
    ['sourcemaps', 'upload', '--release', release, '--url-prefix', '~/assets', 'dist/assets'],
    true,
  )
}
