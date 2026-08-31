import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { type Credentials, graphQLClient, GraphQLRequestError } from './graphql'

const ENDPOINT = 'https://gitlab.example/api/graphql'
const QUERY = 'query { currentUser { username } }'

const server = setupServer()

/** Captures what was actually sent, so the headers and body are asserted. */
let lastRequest: null | { authorization: null | string; body: unknown } = null

function credentials(overrides: Partial<Credentials> = {}) {
  return {
    accessToken: vi.fn(() => Promise.resolve('access-1')),
    refresh: vi.fn(() => Promise.resolve('access-2')),
    ...overrides,
  }
}

function respondWith(body: Record<string, unknown>, status = 200) {
  return http.post(ENDPOINT, async ({ request }) => {
    lastRequest = {
      authorization: request.headers.get('authorization'),
      body: await request.json(),
    }

    return HttpResponse.json(body, { status })
  })
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  lastRequest = null
})

afterAll(() => {
  server.close()
})

describe('graphQLClient', () => {
  it('returns the data GitLab sent', async () => {
    server.use(respondWith({ data: { currentUser: { username: 'rafael' } } }))

    const client = graphQLClient(ENDPOINT, credentials())

    await expect(client.request({ query: QUERY, variables: {} })).resolves.toEqual({
      data: { currentUser: { username: 'rafael' } },
      errors: [],
    })
  })

  it('sends the credential as a bearer token and the query as JSON', async () => {
    server.use(respondWith({ data: {} }))

    await graphQLClient(ENDPOINT, credentials()).request({
      query: QUERY,
      variables: { first: 100 },
    })

    expect(lastRequest?.authorization).toBe('Bearer access-1')
    expect(lastRequest?.body).toEqual({ query: QUERY, variables: { first: 100 } })
  })

  it('renews once and retries when the credential is rejected', async () => {
    let attempts = 0
    server.use(
      http.post(ENDPOINT, () => {
        attempts += 1

        return attempts === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json({ data: { ok: true } })
      }),
    )
    const account = credentials()

    await expect(
      graphQLClient(ENDPOINT, account).request({ query: QUERY, variables: {} }),
    ).resolves.toEqual({ data: { ok: true }, errors: [] })
    expect(account.refresh).toHaveBeenCalledTimes(1)
  })

  it('sends the renewed credential on the retry', async () => {
    let attempts = 0
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        attempts += 1
        lastRequest = {
          authorization: request.headers.get('authorization'),
          body: await request.json(),
        }

        return attempts === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json({ data: {} })
      }),
    )

    await graphQLClient(ENDPOINT, credentials()).request({ query: QUERY, variables: {} })

    expect(lastRequest?.authorization).toBe('Bearer access-2')
  })

  it('gives up after one renewal, rather than looping', async () => {
    let attempts = 0
    server.use(
      http.post(ENDPOINT, () => {
        attempts += 1

        return new HttpResponse(null, { status: 401 })
      }),
    )
    const account = credentials()

    await expect(
      graphQLClient(ENDPOINT, account).request({ query: QUERY, variables: {} }),
    ).rejects.toMatchObject({ failure: { kind: 'unauthorized' } })
    expect(attempts).toBe(2)
    expect(account.refresh).toHaveBeenCalledTimes(1)
  })

  it('reports GraphQL errors inside a 200 response, which is where they live', async () => {
    server.use(
      respondWith({ errors: [{ message: 'Field does not exist' }, { message: 'And another' }] }),
    )

    await expect(
      graphQLClient(ENDPOINT, credentials()).request({ query: QUERY, variables: {} }),
    ).rejects.toMatchObject({
      failure: { kind: 'rejected', messages: ['Field does not exist', 'And another'] },
    })
  })

  it('names an error with no message rather than dropping it', async () => {
    server.use(respondWith({ errors: [{ code: 500 }] }))

    await expect(
      graphQLClient(ENDPOINT, credentials()).request({ query: QUERY, variables: {} }),
    ).rejects.toMatchObject({ failure: { messages: ['Unknown error'] } })
  })

  it('reports an unreachable endpoint as unavailable', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.error()))

    await expect(
      graphQLClient(ENDPOINT, credentials()).request({ query: QUERY, variables: {} }),
    ).rejects.toMatchObject({ failure: { kind: 'unavailable' } })
  })

  it('reports a server error as unavailable', async () => {
    server.use(respondWith({}, 503))

    await expect(
      graphQLClient(ENDPOINT, credentials()).request({ query: QUERY, variables: {} }),
    ).rejects.toBeInstanceOf(GraphQLRequestError)
  })

  it('reports a response that is not JSON as unavailable', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.text('<html>maintenance</html>')))

    await expect(
      graphQLClient(ENDPOINT, credentials()).request({ query: QUERY, variables: {} }),
    ).rejects.toMatchObject({ failure: { kind: 'unavailable' } })
  })

  it('lets an abort through as an abort, not as a failure', async () => {
    server.use(respondWith({ data: {} }))
    const controller = new AbortController()
    controller.abort()

    await expect(
      graphQLClient(ENDPOINT, credentials()).request({
        query: QUERY,
        signal: controller.signal,
        variables: {},
      }),
    ).rejects.toThrow(DOMException)
  })

  it('returns empty data without inventing a failure', async () => {
    server.use(respondWith({ data: null }))

    await expect(
      graphQLClient(ENDPOINT, credentials()).request({ query: QUERY, variables: {} }),
    ).resolves.toEqual({ data: null, errors: [] })
  })
})

/**
 * GitLab answers a partly resolvable request with `200`, the entries it could
 * resolve in `data`, and the rest as errors beside them. Treating that as total
 * failure emptied a reader's dashboard in production, permanently, over three
 * entries out of twenty-five.
 */
describe('an answer that is partly usable', () => {
  const WITHHELD = 'Cannot return null for non-nullable field Timelog.project'

  it('returns the data, with the error messages beside it', async () => {
    server.use(
      respondWith({ data: { nodes: [{ ok: true }, null] }, errors: [{ message: WITHHELD }] }),
    )

    await expect(
      graphQLClient(ENDPOINT, credentials()).request({ query: QUERY, variables: {} }),
    ).resolves.toEqual({ data: { nodes: [{ ok: true }, null] }, errors: [WITHHELD] })
  })

  it('is used however many errors came with it', async () => {
    const errors = [{ message: WITHHELD }, { message: WITHHELD }, { message: WITHHELD }]
    server.use(respondWith({ data: { nodes: [] }, errors }))

    const answer = await graphQLClient(ENDPOINT, credentials()).request({
      query: QUERY,
      variables: {},
    })

    expect(answer.data).toEqual({ nodes: [] })
    expect(answer.errors).toHaveLength(3)
  })

  it('is a failure when the errors came with no data at all', async () => {
    server.use(respondWith({ data: null, errors: [{ message: WITHHELD }] }))

    await expect(
      graphQLClient(ENDPOINT, credentials()).request({ query: QUERY, variables: {} }),
    ).rejects.toMatchObject({ failure: { kind: 'rejected', messages: [WITHHELD] } })
  })

  it('reports no errors when the whole request resolved', async () => {
    server.use(respondWith({ data: { ok: true } }))

    const answer = await graphQLClient(ENDPOINT, credentials()).request({
      query: QUERY,
      variables: {},
    })

    expect(answer.errors).toEqual([])
  })
})
