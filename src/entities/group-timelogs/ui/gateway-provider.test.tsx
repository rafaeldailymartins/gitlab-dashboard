import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { GroupTimelogGateway } from '../model/ports'

import { GroupTimelogGatewayProvider, useGroupTimelogGateway } from './gateway-provider'

function Consumer() {
  const gateway = useGroupTimelogGateway()

  return <span>{typeof gateway.timelogs}</span>
}

function fakeGateway() {
  return {
    columns: vi.fn(() =>
      Promise.resolve({ byColumn: new Map(), period: { entryCount: 0, seconds: 0 } }),
    ),
    groups: vi.fn(() => Promise.resolve([])),
    probe: vi.fn(() =>
      Promise.resolve({
        access: null,
        declared: { entryCount: 0, seconds: 0 },
        group: null,
        perPerson: new Map(),
      }),
    ),
    roster: vi.fn(() => Promise.resolve({ access: null, group: null, members: [] })),
    timelogs: vi.fn(() => Promise.resolve({ entries: [], group: null, nextCursor: null })),
  } satisfies GroupTimelogGateway
}

describe('GroupTimelogGatewayProvider', () => {
  it('hands the gateway to whatever is below it', () => {
    render(
      <GroupTimelogGatewayProvider gateway={fakeGateway()}>
        <Consumer />
      </GroupTimelogGatewayProvider>,
    )

    expect(screen.getByText('function')).toBeInTheDocument()
  })

  it('says so plainly when a screen is rendered without one', () => {
    // React logs the error it re-throws; the assertion is on the message.
    vi.spyOn(console, 'error').mockImplementation(() => null)

    expect(() => render(<Consumer />)).toThrow(/outside a GroupTimelogGatewayProvider/)
  })
})
