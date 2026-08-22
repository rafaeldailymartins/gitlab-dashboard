const DEFAULT_BASE_URL = 'https://gitlab.com'

export type ConfigResult =
  | { readonly config: GitLabConfig; readonly kind: 'configured' }
  | { readonly kind: 'missing-client-id' }

export interface GitLabConfig {
  /** No trailing slash, so paths can be appended without doubling it. */
  readonly baseUrl: string
  /**
   * The OAuth application id. Public by design: this is a PKCE public client,
   * so there is no secret, and the id ships inside the bundle.
   */
  readonly clientId: string
}

/** The configuration this build was compiled with. */
export function gitLabConfig(): ConfigResult {
  return readGitLabConfig(import.meta.env)
}

/**
 * Reads the configuration out of a plain record.
 *
 * The environment is passed in rather than reached for, so the rule that an
 * absent client id is a distinguishable state — not a crash, and not a silent
 * empty string — can be tested.
 */
export function readGitLabConfig(env: Record<string, string | undefined>): ConfigResult {
  const clientId = env['VITE_GITLAB_CLIENT_ID']?.trim() ?? ''

  if (clientId === '') {
    return { kind: 'missing-client-id' }
  }

  const baseUrl = env['VITE_GITLAB_BASE_URL']?.trim() ?? ''

  return {
    config: {
      baseUrl: withoutTrailingSlash(baseUrl === '' ? DEFAULT_BASE_URL : baseUrl),
      clientId,
    },
    kind: 'configured',
  }
}

function withoutTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}
