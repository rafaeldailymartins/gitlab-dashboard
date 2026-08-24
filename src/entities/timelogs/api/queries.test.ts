import { describe, expect, it, vi } from 'vitest'

import type { TimelogGateway, TimelogPage } from '../model/ports'

import { myTimelogsQuery } from './queries'

const EMPTY: TimelogPage = { entries: [], nextCursor: null }

function fakeGateway() {
  return { myTimelogs: vi.fn(() => Promise.resolve(EMPTY)) } satisfies TimelogGateway
}

describe('myTimelogsQuery', () => {
  it('keys the whole history under one entry, so every screen shares it', () => {
    expect(myTimelogsQuery(fakeGateway()).queryKey).toEqual(['timelogs', 'mine'])
  })

  it('starts from the newest entries', () => {
    expect(myTimelogsQuery(fakeGateway()).initialPageParam).toBeNull()
  })

  it('continues from the cursor the last page reported', () => {
    const { getNextPageParam } = myTimelogsQuery(fakeGateway())

    expect(getNextPageParam({ entries: [], nextCursor: 'older' }, [], null, [])).toBe('older')
  })

  it('stops when a page reports nothing older', () => {
    const { getNextPageParam } = myTimelogsQuery(fakeGateway())

    expect(getNextPageParam(EMPTY, [], null, [])).toBeNull()
  })

  it('asks the gateway for the page the cursor points at, and can be cancelled', async () => {
    const gateway = fakeGateway()
    const { signal } = new AbortController()
    const { queryFn } = myTimelogsQuery(gateway)

    if (typeof queryFn !== 'function') {
      throw new TypeError('The query has no function to run')
    }

    await queryFn({ pageParam: 'older', signal } as never)

    expect(gateway.myTimelogs).toHaveBeenCalledWith({ after: 'older' }, signal)
  })
})
