import { describe, expect, it, vi } from 'vitest'

import { GraphQLRequestError } from './graphql'
import { createQueryClient } from './query-client'

const MINUTE = 60 * 1000

function retryPolicy() {
  const retry = createQueryClient().getDefaultOptions().queries?.retry

  if (typeof retry !== 'function') {
    throw new TypeError('The query client has no retry policy')
  }

  return retry
}

describe('createQueryClient', () => {
  it('keeps a report cached long enough to be the first paint on a return visit', () => {
    const { gcTime, staleTime } = createQueryClient().getDefaultOptions().queries ?? {}

    expect(staleTime).toBe(5 * MINUTE)
    expect(gcTime).toBe(24 * 60 * MINUTE)
  })

  it('retries a request that could plausibly succeed next time', () => {
    const retry = retryPolicy()
    const unavailable = new GraphQLRequestError({ kind: 'unavailable' })

    expect(retry(0, unavailable)).toBe(true)
    expect(retry(1, unavailable)).toBe(true)
  })

  it('gives up rather than retrying forever', () => {
    expect(retryPolicy()(2, new GraphQLRequestError({ kind: 'unavailable' }))).toBe(false)
  })

  it('does not retry a credential GitLab has already refused twice', () => {
    expect(retryPolicy()(0, new GraphQLRequestError({ kind: 'unauthorized' }))).toBe(false)
  })

  it('does not retry a request GitLab understood and refused', () => {
    const rejected = new GraphQLRequestError({ kind: 'rejected', messages: ['No such field'] })

    expect(retryPolicy()(0, rejected)).toBe(false)
  })

  it('retries an error it cannot classify, which could be the network', () => {
    expect(retryPolicy()(0, new Error('Load failed'))).toBe(true)
  })
})

/** Runs one query to its end, without the real retry delay. */
async function failed(error: Error, meta?: Record<string, unknown>) {
  const onFault = vi.fn()
  const queryFn = vi.fn(() => Promise.reject(error))
  const client = createQueryClient({ onFault })

  await client
    .query({
      ...(meta === undefined ? {} : { meta }),
      queryFn,
      queryKey: ['q'],
      retryDelay: 0,
    })
    .catch((error_: unknown) => error_)

  return { onFault, queryFn }
}

describe('the faults a query reports', () => {
  it('reports GitLab being unreachable once, after the retries are spent (OBS-1)', async () => {
    const { onFault, queryFn } = await failed(new GraphQLRequestError({ kind: 'unavailable' }))

    expect(queryFn).toHaveBeenCalledTimes(3)
    expect(onFault).toHaveBeenCalledOnce()
    expect(onFault.mock.calls[0]?.[0]).toMatchObject({ kind: 'unavailable' })
  })

  it('does not report a credential GitLab no longer accepts, which is the session ending', async () => {
    const { onFault } = await failed(new GraphQLRequestError({ kind: 'unauthorized' }))

    expect(onFault).not.toHaveBeenCalled()
  })

  it('does not report a query whose endpoint reports its own faults', async () => {
    const { onFault } = await failed(new Error('the teams store answered 503'), {
      reportFaults: false,
    })

    expect(onFault).not.toHaveBeenCalled()
  })

  it('reports nowhere when nobody asked to be told', async () => {
    const client = createQueryClient()

    await expect(
      client.query({
        queryFn: () => Promise.reject(new Error('x')),
        queryKey: ['q'],
        retry: false,
      }),
    ).rejects.toThrow('x')
  })
})
