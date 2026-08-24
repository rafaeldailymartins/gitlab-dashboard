import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SelectField } from './select-field'

const OPTIONS = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

describe('SelectField', () => {
  it('associates the label with the control', () => {
    render(<SelectField label="Colour scheme" onChange={vi.fn()} options={OPTIONS} value="light" />)

    expect(screen.getByLabelText('Colour scheme')).toBeInstanceOf(HTMLSelectElement)
  })

  it('shows the current value as selected', () => {
    render(<SelectField label="Colour scheme" onChange={vi.fn()} options={OPTIONS} value="dark" />)

    expect(screen.getByRole('combobox')).toHaveValue('dark')
  })

  it('renders every option', () => {
    render(<SelectField label="Colour scheme" onChange={vi.fn()} options={OPTIONS} value="dark" />)

    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByRole('option', { name: 'Light' })).toBeInTheDocument()
  })

  it('reports the chosen value', async () => {
    const onChange = vi.fn()
    render(
      <SelectField label="Colour scheme" onChange={onChange} options={OPTIONS} value="light" />,
    )

    await userEvent.selectOptions(screen.getByRole('combobox'), 'dark')

    expect(onChange).toHaveBeenCalledExactlyOnceWith('dark')
  })

  it('links a description to the control for assistive technology', () => {
    render(
      <SelectField
        description="Decides when a day starts."
        label="Time zone"
        onChange={vi.fn()}
        options={OPTIONS}
        value="light"
      />,
    )

    expect(screen.getByRole('combobox')).toHaveAccessibleDescription('Decides when a day starts.')
  })

  it('omits the description association when there is no description', () => {
    render(<SelectField label="Time zone" onChange={vi.fn()} options={OPTIONS} value="light" />)

    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-describedby')
  })
})
