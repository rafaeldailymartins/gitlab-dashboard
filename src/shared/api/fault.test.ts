import { CancelledError } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { faultOf } from './fault'
import { GraphQLRequestError } from './graphql'

describe('faultOf', () => {
  it('is nothing for a credential GitLab no longer accepts, which is the session ending', () => {
    expect(faultOf(new GraphQLRequestError({ kind: 'unauthorized' }))).toBeNull()
  })

  it('is a fault when GitLab could not be reached', () => {
    const error = new GraphQLRequestError({ kind: 'unavailable' })
    const fault = faultOf(error)

    expect(fault).toEqual({ error, kind: 'unavailable' })
    // The copy points at where the request failed, not at where it was copied.
    expect(fault?.error.stack).toBe(error.stack)
  })

  it('is a fault when GitLab refused the request, and does not carry what GitLab said', () => {
    const fault = faultOf(
      new GraphQLRequestError({ kind: 'rejected', messages: ['User ada not found'] }),
    )

    expect(fault?.kind).toBe('rejected')
    expect(fault?.error.message).toBe('GraphQL request failed: rejected')
    expect(fault?.error).toBeInstanceOf(GraphQLRequestError)
    expect(JSON.stringify(fault)).not.toContain('ada')
  })

  it('is a fault for anything else that went wrong, such as an answer of the wrong shape', () => {
    const error = new TypeError('Invalid input: expected string, received null')

    expect(faultOf(error)).toEqual({ error, kind: 'unexpected' })
  })

  it('wraps a thrown value that is not an error, without its contents', () => {
    const fault = faultOf({ username: 'ada' })

    expect(fault?.kind).toBe('unexpected')
    expect(fault?.error).toBeInstanceOf(Error)
    expect(fault?.error.message).not.toContain('ada')
  })

  it('is nothing for a request the app itself called off', () => {
    expect(faultOf(new DOMException('The user aborted a request.', 'AbortError'))).toBeNull()
    expect(faultOf(new CancelledError())).toBeNull()
  })
})
