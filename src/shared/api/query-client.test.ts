import { describe, expect, it } from 'vitest'

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
