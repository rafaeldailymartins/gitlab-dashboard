import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LocaleProvider } from '@/shared/i18n'

import { NotConfiguredPage } from './not-configured-page'

function renderPage(redirectUri = 'http://localhost:3000/auth/callback') {
  return render(
    <LocaleProvider>
      <NotConfiguredPage redirectUri={redirectUri} />
    </LocaleProvider>,
  )
}

describe('NotConfiguredPage', () => {
  it('says what is missing', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/no gitlab application/i)
  })

  it('says the value is public, so nobody hunts for a secret to protect', () => {
    renderPage()

    expect(screen.getByText(/no secret to protect/i)).toBeInTheDocument()
  })

  it('lists the steps in order', () => {
    renderPage()

    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('spells out the exact redirect URI to register', () => {
    renderPage('https://hours.example/auth/callback')

    expect(screen.getByText(/https:\/\/hours\.example\/auth\/callback/)).toBeInTheDocument()
  })

  it('names the scope and the confidential setting that trip people up', () => {
    renderPage()

    expect(screen.getByText(/read_api/)).toBeInTheDocument()
    expect(screen.getByText(/confidential unchecked/i)).toBeInTheDocument()
  })

  it('names the environment variable to set', () => {
    renderPage()

    expect(screen.getByText(/VITE_GITLAB_CLIENT_ID/)).toBeInTheDocument()
  })
})
