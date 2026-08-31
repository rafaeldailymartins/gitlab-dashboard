import { describe, expect, it, vi } from 'vitest'

import type { GraphQLClient } from '@/shared/api'

import { gitLabViewerGateway } from './gitlab-viewer-gateway'

function clientReturning(data: unknown) {
  const request = vi.fn<GraphQLClient['request']>(() => Promise.resolve({ data, errors: [] }))

  return { client: { request } satisfies GraphQLClient, request }
}

describe('gitLabViewerGateway', () => {
  it('reads the name of whoever the credential belongs to', async () => {
    const { client } = clientReturning({ currentUser: { name: 'Rafael Daily Santos Martins' } })

    await expect(gitLabViewerGateway(client).me()).resolves.toEqual({
      name: 'Rafael Daily Santos Martins',
    })
  })

  it('asks for the name and nothing else', async () => {
    const { client, request } = clientReturning({ currentUser: { name: 'Ada' } })

    await gitLabViewerGateway(client).me()

    const sent = request.mock.calls.at(0)?.at(0)?.query ?? ''

    expect(sent).toContain('currentUser')
    // The hours live behind their own query, keyed and cached separately. A
    // screen that wants a name must not pay for a season of history.
    expect(sent).not.toContain('timelogs')
  })

  it('resolves nobody when GitLab accepts the credential but finds no person', async () => {
    const { client } = clientReturning({ currentUser: null })

    await expect(gitLabViewerGateway(client).me()).resolves.toBeNull()
  })

  it('passes the abort signal through, so a leaving screen stops asking', async () => {
    const { client, request } = clientReturning({ currentUser: { name: 'Ada' } })
    const { signal } = new AbortController()

    await gitLabViewerGateway(client).me(signal)

    expect(request.mock.calls.at(0)?.at(0)?.signal).toBe(signal)
  })

  it('refuses a payload whose shape changed, naming the field', async () => {
    const { client } = clientReturning({ currentUser: { name: 42 } })

    // The alternative is `undefined` reaching a component and greeting nobody.
    await expect(gitLabViewerGateway(client).me()).rejects.toThrow(/name/i)
  })
})
