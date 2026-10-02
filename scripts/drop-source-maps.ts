/**
 * Deletes every source map from `dist/`, and fails if any chunk still names one.
 *
 * The maps are written so the tracker can turn a minified stack back into the
 * source (OBS-8); `@sentry/vite-plugin` uploads them when the build has a token.
 * They are not served: `build.sourcemap` is `'hidden'`, so no chunk points at
 * one, and this removes the files themselves — on every build, uploaded or not,
 * so a fork or a local build is held to the same rule as production's.
 *
 * Checked here rather than by a browser because a browser cannot tell a missing
 * map from a preview server falling back to the page. A build that would
 * publish a map does not finish.
 */
import { readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

const DIST = 'dist'

/** What a chunk carries when it points at its map, in either comment style. */
const MAP_REFERENCE = /[#@] sourceMappingURL=/u

const entries = await readdir(DIST, { recursive: true, withFileTypes: true })
const files = entries
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath, entry.name))

const maps = files.filter((file) => file.endsWith('.map'))

await Promise.all(maps.map((file) => rm(file)))

const referencing: string[] = []

for (const file of files.filter((candidate) => /\.(?:css|js)$/u.test(candidate))) {
  if (MAP_REFERENCE.test(await readFile(file, 'utf8'))) {
    referencing.push(file)
  }
}

if (referencing.length > 0) {
  throw new Error(`These files still name a source map:\n  ${referencing.join('\n  ')}`)
}

process.stdout.write(`Removed ${String(maps.length)} source map(s) from ${DIST}/\n`)
