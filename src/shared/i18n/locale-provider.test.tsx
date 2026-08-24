import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LocaleProvider, useActiveLocale } from './locale-provider'

function Probe() {
  const { changeLocale, locale } = useActiveLocale()

  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <button
        onClick={() => {
          changeLocale('pt-BR')
        }}
        type="button"
      >
        português
      </button>
    </div>
  )
}

describe('LocaleProvider', () => {
  it('starts from the language the compiler resolved', () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )

    expect(screen.getByTestId('locale')).toHaveTextContent('en')
  })

  it('declares the active language on the document', () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )

    expect(document.documentElement).toHaveAttribute('lang', 'en')
  })

  it('changes the language and the document declaration together', async () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByTestId('locale')).toHaveTextContent('pt-BR')
    expect(document.documentElement).toHaveAttribute('lang', 'pt-BR')
  })
})

describe('useActiveLocale', () => {
  it('refuses to be used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    expect(() => render(<Probe />)).toThrow(/outside a LocaleProvider/)

    consoleError.mockRestore()
  })
})
