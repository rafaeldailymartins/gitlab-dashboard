import { describe, expect, it } from 'vitest'

import { readGitLabConfig } from './env'

describe('readGitLabConfig', () => {
  it('reads the client id and defaults the instance to gitlab.com', () => {
    expect(readGitLabConfig({ VITE_GITLAB_CLIENT_ID: 'client-123' })).toEqual({
      config: { baseUrl: 'https://gitlab.com', clientId: 'client-123' },
      kind: 'configured',
    })
  })

  it('accepts a self-hosted instance', () => {
    const result = readGitLabConfig({
      VITE_GITLAB_BASE_URL: 'https://gitlab.company.example',
      VITE_GITLAB_CLIENT_ID: 'client-123',
    })

    expect(result).toMatchObject({ config: { baseUrl: 'https://gitlab.company.example' } })
  })

  it('drops a trailing slash, so paths never double up', () => {
    const result = readGitLabConfig({
      VITE_GITLAB_BASE_URL: 'https://gitlab.company.example/',
      VITE_GITLAB_CLIENT_ID: 'client-123',
    })

    expect(result).toMatchObject({ config: { baseUrl: 'https://gitlab.company.example' } })
  })

  it.each([undefined, '', ' '.repeat(3)])(
    'reports a missing client id for %o rather than pretending to be configured',
    (clientId) => {
      expect(readGitLabConfig({ VITE_GITLAB_CLIENT_ID: clientId })).toEqual({
        kind: 'missing-client-id',
      })
    },
  )

  it('reports a missing client id even when the instance is set', () => {
    const result = readGitLabConfig({ VITE_GITLAB_BASE_URL: 'https://gitlab.company.example' })

    expect(result.kind).toBe('missing-client-id')
  })

  it('trims surrounding whitespace from the client id', () => {
    const result = readGitLabConfig({ VITE_GITLAB_CLIENT_ID: '  client-123  ' })

    expect(result).toMatchObject({ config: { clientId: 'client-123' } })
  })

  it('falls back to gitlab.com when the instance is blank', () => {
    const result = readGitLabConfig({
      VITE_GITLAB_BASE_URL: ' '.repeat(3),
      VITE_GITLAB_CLIENT_ID: 'client-123',
    })

    expect(result).toMatchObject({ config: { baseUrl: 'https://gitlab.com' } })
  })
})
