import { describe, expect, it, vi } from 'vitest'

import type { ViewerGateway } from '../model/ports'

import { viewerQuery } from './queries'

function fakeGateway() {
  return { me: vi.fn(() => Promise.resolve({ name: 'Ada' })) } satisfies ViewerGateway
}

describe('viewerQuery', () => {
  it('keys the viewer apart from the hours, so neither refetch drags the other', () => {
    expect(viewerQuery(fakeGateway()).queryKey).toEqual(['viewer', 'me'])
  })

  it('stays fresh for a day, because a name does not change while hours do', () => {
    expect(viewerQuery(fakeGateway()).staleTime).toBe(86_400_000)
  })

  it('asks the gateway, and can be cancelled', async () => {
    const gateway = fakeGateway()
    const { signal } = new AbortController()
    const { queryFn } = viewerQuery(gateway)

    if (typeof queryFn !== 'function') {
      throw new TypeError('The query has no function to run')
    }

    await queryFn({ signal } as never)

    expect(gateway.me).toHaveBeenCalledWith(signal)
  })
})
