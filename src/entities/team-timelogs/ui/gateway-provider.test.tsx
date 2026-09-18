import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TeamTimelogGateway } from '../model/ports'

import { TeamTimelogGatewayProvider, useTeamTimelogGateway } from './gateway-provider'

function Consumer() {
  const gateway = useTeamTimelogGateway()

  return <span>{typeof gateway.timelogs}</span>
}

function fakeGateway() {
  return {
    columns: vi.fn(() =>
      Promise.resolve({ byColumn: new Map(), period: { entryCount: 0, seconds: 0 } }),
    ),
    following: vi.fn(() => Promise.resolve({ members: [] })),
    group: vi.fn(() => Promise.resolve(null)),
    groups: vi.fn(() => Promise.resolve([])),
    people: vi.fn(() => Promise.resolve([])),
    suggestions: vi.fn(() => Promise.resolve({ partial: false, people: [] })),
    timelogs: vi.fn(() => Promise.resolve({ members: [] })),
  } satisfies TeamTimelogGateway
}

describe('TeamTimelogGatewayProvider', () => {
  it('hands the gateway to whatever is below it', () => {
    render(
      <TeamTimelogGatewayProvider gateway={fakeGateway()}>
        <Consumer />
      </TeamTimelogGatewayProvider>,
    )

    expect(screen.getByText('function')).toBeInTheDocument()
  })

  it('says so plainly when a screen is rendered without one', () => {
    // React logs the error it re-throws; the assertion is on the message.
    vi.spyOn(console, 'error').mockImplementation(() => null)

    expect(() => render(<Consumer />)).toThrow(/outside a TeamTimelogGatewayProvider/)
  })
})
