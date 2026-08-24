import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewerGateway } from '../model/ports'

import { useViewerGateway, ViewerGatewayProvider } from './gateway-provider'

function Consumer() {
  const gateway = useViewerGateway()

  return <span>{typeof gateway.me}</span>
}

function fakeGateway() {
  return { me: vi.fn(() => Promise.resolve({ name: 'Ada' })) } satisfies ViewerGateway
}

describe('ViewerGatewayProvider', () => {
  it('hands the gateway to whatever is below it', () => {
    render(
      <ViewerGatewayProvider gateway={fakeGateway()}>
        <Consumer />
      </ViewerGatewayProvider>,
    )

    expect(screen.getByText('function')).toBeInTheDocument()
  })

  it('says so plainly when a screen is rendered without one', () => {
    // React logs the error it re-throws; the assertion is on the message.
    vi.spyOn(console, 'error').mockImplementation(() => null)

    expect(() => render(<Consumer />)).toThrow(/outside a ViewerGatewayProvider/)
  })
})
