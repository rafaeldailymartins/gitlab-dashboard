const DEFAULT_BASE_URL = 'https://gitlab.com'

export interface GitLabConfig {
  readonly baseUrl: string
  readonly clientId: string
}

/**
 * The same two variables the bundle is built with — not a third.
 *
 * `src/shared/config/env.ts` cannot be imported here: it reads `import.meta.env`,
 * which does not exist on Node, and it lives under `src/`, which is browser-only
 * by lint rule. So this restates that file's rule for the one place it has to
 * hold twice. A `VITE_` prefix means something to the bundler and nothing to a
 * serverless runtime, where these arrive as ordinary environment variables.
 *
 * This is why the feature adds no new setting: the audience an assertion must
 * carry is the application id the browser already signs in with.
 */
export function gitLabConfig(env: Record<string, string | undefined>): GitLabConfig | null {
  const clientId = env['VITE_GITLAB_CLIENT_ID']?.trim() ?? ''

  if (clientId === '') {
    return null
  }

  const baseUrl = env['VITE_GITLAB_BASE_URL']?.trim() ?? ''

  return { baseUrl: withoutTrailingSlash(baseUrl === '' ? DEFAULT_BASE_URL : baseUrl), clientId }
}

function withoutTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}
