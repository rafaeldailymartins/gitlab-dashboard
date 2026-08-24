import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { WeekdayTargetInput } from './weekday-target-input'

describe('WeekdayTargetInput', () => {
  it('labels the field with the weekday', () => {
    render(<WeekdayTargetInput hours={8} label="Mon" onCommit={vi.fn()} />)

    expect(screen.getByLabelText('Mon')).toHaveValue(8)
  })

  it.each([
    ['6', 6],
    ['7.5', 7.5],
    ['0', 0],
  ])('commits %s, which the domain accepts', async (typed, committed) => {
    const onCommit = vi.fn()
    render(<WeekdayTargetInput hours={8} label="Mon" onCommit={onCommit} />)

    await userEvent.clear(screen.getByLabelText('Mon'))
    await userEvent.type(screen.getByLabelText('Mon'), typed)

    expect(onCommit).toHaveBeenLastCalledWith(committed)
  })

  it('explains the range instead of committing an impossible target', async () => {
    const onCommit = vi.fn()
    render(<WeekdayTargetInput hours={8} label="Mon" onCommit={onCommit} />)

    await userEvent.clear(screen.getByLabelText('Mon'))
    await userEvent.type(screen.getByLabelText('Mon'), '25')

    expect(onCommit).not.toHaveBeenCalledWith(25)
    expect(screen.getByText(/between 0 and 24/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Mon')).toHaveAccessibleDescription(/between 0 and 24/i)
  })

  it('marks the control invalid for assistive technology', async () => {
    render(<WeekdayTargetInput hours={8} label="Mon" onCommit={vi.fn()} />)

    await userEvent.clear(screen.getByLabelText('Mon'))

    expect(screen.getByLabelText('Mon')).toHaveAttribute('aria-invalid', 'true')
  })

  it('lets the field be emptied on the way to a new value', async () => {
    const onCommit = vi.fn()
    render(<WeekdayTargetInput hours={8} label="Mon" onCommit={onCommit} />)

    await userEvent.clear(screen.getByLabelText('Mon'))

    expect(screen.getByLabelText('Mon')).toHaveValue(null)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('reports no error while the value is usable', () => {
    render(<WeekdayTargetInput hours={8} label="Mon" onCommit={vi.fn()} />)

    expect(screen.getByLabelText('Mon')).not.toHaveAttribute('aria-describedby')
  })
})
