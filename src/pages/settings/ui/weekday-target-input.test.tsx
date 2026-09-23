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

  /*
   * Until the settings began following the reader between devices, the only
   * thing that moved `hours` was this field, so a draft seeded once on mount was
   * never wrong. Now the store can move it — and a field left showing the number
   * this device used to have, while every other screen measures against the one
   * it now has, is the worst kind of stale: two numbers on one screen, both
   * looking authoritative.
   */
  it('follows a target that changed somewhere else', () => {
    const { rerender } = render(<WeekdayTargetInput hours={8} label="Mon" onCommit={vi.fn()} />)

    rerender(<WeekdayTargetInput hours={6} label="Mon" onCommit={vi.fn()} />)

    expect(screen.getByLabelText('Mon')).toHaveValue(6)
  })

  // The half that must not regress with it: a field being emptied on the way to
  // a new value commits nothing, so nothing moves `hours`, so nothing refills it.
  it('does not refill a field the reader is in the middle of clearing', async () => {
    const { rerender } = render(<WeekdayTargetInput hours={8} label="Mon" onCommit={vi.fn()} />)

    await userEvent.clear(screen.getByLabelText('Mon'))
    rerender(<WeekdayTargetInput hours={8} label="Mon" onCommit={vi.fn()} />)

    expect(screen.getByLabelText('Mon')).toHaveValue(null)
  })
})
