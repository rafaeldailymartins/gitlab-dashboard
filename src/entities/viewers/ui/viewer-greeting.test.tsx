import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakeViewerGateway, renderReport } from '~tests/support/report'

import { ViewerGreeting } from './viewer-greeting'

describe('ViewerGreeting', () => {
  it('greets the reader by their first name', async () => {
    renderReport(<ViewerGreeting />)

    expect(await screen.findByText('Hello, Ada')).toBeInTheDocument()
  })

  it('says nothing when GitLab resolves nobody behind the credential', async () => {
    const { container } = renderReport(<ViewerGreeting />, { viewer: fakeViewerGateway(null) })

    await expect.poll(() => container.textContent).toBe('')
  })

  it('says nothing when the request fails, rather than greeting an error', async () => {
    const viewer = { me: vi.fn(() => Promise.reject(new Error('unreachable'))) }
    const { container } = renderReport(<ViewerGreeting />, { viewer })

    await expect.poll(() => viewer.me).toHaveBeenCalled()
    expect(container.textContent).toBe('')
  })

  it('keeps its height before the name arrives, so the page below does not move', () => {
    // The greeting sits above a heading. Appearing later would push the whole
    // screen down, and this app asserts that loading does not move the page.
    const { container } = renderReport(<ViewerGreeting />)

    expect(container.firstElementChild?.className).toContain('h-5')
  })
})
