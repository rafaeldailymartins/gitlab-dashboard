import { describe, expect, it } from 'vitest'

import { gitLabConfig } from './gitlab.mjs'

const CLIENT_ID = 'a1b2c3d4'

/**
 * The two variables the bundle is built with, as a serverless runtime sees
 * them: ordinary environment entries, the `VITE_` prefix meaning nothing here.
 */
const ENVIRONMENT = {
  VITE_GITLAB_BASE_URL: 'https://gitlab.example',
  VITE_GITLAB_CLIENT_ID: CLIENT_ID,
}

const WITHOUT_CLIENT_ID: readonly [string, Record<string, string | undefined>][] = [
  ['nothing is set at all', {}],
  ['it is empty', { VITE_GITLAB_CLIENT_ID: '' }],
  ['it is whitespace', { VITE_GITLAB_CLIENT_ID: ' \t ' }],
  ['it is explicitly undefined', { VITE_GITLAB_CLIENT_ID: undefined }],
]

const DEFAULTED: readonly [string, Record<string, string>][] = [
  ['is not set', { VITE_GITLAB_CLIENT_ID: CLIENT_ID }],
  ['is empty', { VITE_GITLAB_BASE_URL: '', VITE_GITLAB_CLIENT_ID: CLIENT_ID }],
  ['is whitespace', { VITE_GITLAB_BASE_URL: ' \t ', VITE_GITLAB_CLIENT_ID: CLIENT_ID }],
]

describe('gitLabConfig', () => {
  it('reads the instance and the application id the browser signs in with', () => {
    expect(gitLabConfig(ENVIRONMENT)).toEqual({
      baseUrl: 'https://gitlab.example',
      clientId: CLIENT_ID,
    })
  })

  it.each(WITHOUT_CLIENT_ID)('gives nothing when %s', (_absence, environment) => {
    // Distinguishable rather than empty, because the client id is the audience
    // an assertion has to carry. Verifying against an invented one would refuse
    // every reader, and the function answers 503 instead — which is the truth:
    // this deployment cannot establish identity at all.
    expect(gitLabConfig(environment)).toBeNull()
  })

  it.each(DEFAULTED)('falls back to gitlab.com when the instance %s', (_absence, environment) => {
    expect(gitLabConfig(environment)).toMatchObject({ baseUrl: 'https://gitlab.com' })
  })

  it('keeps a self-hosted instance', () => {
    const config = gitLabConfig({ ...ENVIRONMENT, VITE_GITLAB_BASE_URL: 'https://git.acme.dev' })

    expect(config).toMatchObject({ baseUrl: 'https://git.acme.dev' })
  })

  it('takes the environment at its word except for the space around it', () => {
    const config = gitLabConfig({
      VITE_GITLAB_BASE_URL: '  https://gitlab.example  ',
      VITE_GITLAB_CLIENT_ID: `\n${CLIENT_ID} `,
    })

    // A value pasted into a deploy setting arrives with whatever came with it,
    // and an untrimmed client id would be compared against an assertion's
    // audience and never match.
    expect(config).toEqual({ baseUrl: 'https://gitlab.example', clientId: CLIENT_ID })
  })

  it('drops a trailing slash, which is what the issuer is compared as', () => {
    const config = gitLabConfig({ ...ENVIRONMENT, VITE_GITLAB_BASE_URL: 'https://gitlab.example/' })

    // The function hands this same string over as the issuer an assertion must
    // name, and GitLab issues as its own origin with no slash on the end. So
    // this is not cosmetic: keeping the slash would fail the issuer check for
    // every reader of a deployment whose only mistake was a trailing slash.
    expect(config).toMatchObject({ baseUrl: 'https://gitlab.example' })
  })
})
