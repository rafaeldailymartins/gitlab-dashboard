/**
 * Writes the Content-Security-Policy into `dist/_headers` after a build.
 *
 * It has to run after the build and not live in `netlify.toml`, because the
 * policy names the hash of the inline theme script, and that hash is only known
 * once the built `index.html` exists. The alternative — `script-src
 * 'unsafe-inline'` — would permit exactly the injection the policy is for, so it
 * would be weaker than shipping no policy at all while looking stronger.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DIST = 'dist'
const DEFAULT_GITLAB = 'https://gitlab.com'

/** `<script>` blocks with no `src`: the ones a hash has to cover. */
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\S\s]*?)<\/script>/g

/**
 * The origin the app talks to. Read from the same variable the bundle was built
 * with, so a self-managed instance gets a policy that lets it work.
 */
function gitLabOrigin(): string {
  const configured = process.env['VITE_GITLAB_BASE_URL']?.trim()

  return new URL(configured === undefined || configured === '' ? DEFAULT_GITLAB : configured).origin
}

function hashOf(source: string): string {
  return `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`
}

function inlineHashes(html: string): string[] {
  return [...html.matchAll(INLINE_SCRIPT)].map((match) => hashOf(match[1] ?? ''))
}

function policy(scriptHashes: string[]): string {
  return [
    "default-src 'none'",
    `script-src 'self' ${scriptHashes.join(' ')}`,
    // Vite emits a stylesheet file; nothing injects a `<style>` block.
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    // OAuth token exchange and the GraphQL API, and nothing else.
    `connect-src 'self' ${gitLabOrigin()}`,
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

const html = await readFile(path.join(DIST, 'index.html'), 'utf8')
const hashes = inlineHashes(html)

if (hashes.length === 0) {
  throw new Error('No inline script found in dist/index.html: the theme script is missing')
}

const headers = `/*
  Content-Security-Policy: ${policy(hashes)}
`

await writeFile(path.join(DIST, '_headers'), headers, 'utf8')
process.stdout.write(`Wrote dist/_headers with ${String(hashes.length)} inline script hash(es)
`)
