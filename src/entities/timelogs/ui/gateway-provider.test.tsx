import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TimelogGateway } from '../model/ports'

import { TimelogGatewayProvider, useTimelogGateway } from './gateway-provider'

function Consumer() {
  const gateway = useTimelogGateway()

  return <span>{typeof gateway.myTimelogs}</span>
}

function fakeGateway() {
  return {
    myTimelogs: vi.fn(() => Promise.resolve({ entries: [], nextCursor: null })),
  } satisfies TimelogGateway
}

describe('TimelogGatewayProvider', () => {
  it('hands the gateway to whatever is below it', () => {
    render(
      <TimelogGatewayProvider gateway={fakeGateway()}>
        <Consumer />
      </TimelogGatewayProvider>,
    )

    expect(screen.getByText('function')).toBeInTheDocument()
  })

  it('says so plainly when a screen is rendered without one', () => {
    // React logs the error it re-throws; the assertion is on the message.
    vi.spyOn(console, 'error').mockImplementation(() => null)

    expect(() => render(<Consumer />)).toThrow(/outside a TimelogGatewayProvider/)
  })
})
