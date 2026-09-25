import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TeamsDocument, TeamsGateway } from '../model/ports'

import { TeamsGatewayProvider, useTeamsGateway } from './teams-provider'

function Consumer() {
  const gateway = useTeamsGateway()

  return <span>{typeof gateway.read}</span>
}

function fakeGateway() {
  return {
    read: vi.fn(() => Promise.resolve({ etag: null, teams: [] })),
    write: vi.fn((document: TeamsDocument) => Promise.resolve(document)),
  } satisfies TeamsGateway
}

describe('TeamsGatewayProvider', () => {
  it('hands the gateway to whatever is below it', () => {
    render(
      <TeamsGatewayProvider gateway={fakeGateway()}>
        <Consumer />
      </TeamsGatewayProvider>,
    )

    expect(screen.getByText('function')).toBeInTheDocument()
  })

  it('says so plainly when a screen is rendered without one', () => {
    // React logs the error it re-throws; the assertion is on the message.
    vi.spyOn(console, 'error').mockImplementation(() => null)

    expect(() => render(<Consumer />)).toThrow(/outside a TeamsGatewayProvider/)
  })
})
