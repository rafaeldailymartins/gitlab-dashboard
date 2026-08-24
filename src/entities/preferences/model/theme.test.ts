import { describe, expect, it } from 'vitest'

import { decodeThemeChoice, resolveTheme, THEME_CHOICES } from './theme'

describe('decodeThemeChoice', () => {
  it.each(THEME_CHOICES)('reads back the stored choice %s', (choice) => {
    expect(decodeThemeChoice(choice)).toBe(choice)
  })

  it.each([null, '', 'purple', 'DARK', 'auto'])(
    'follows the system for the unusable value %o',
    (stored) => {
      expect(decodeThemeChoice(stored)).toBe('system')
    },
  )
})

describe('resolveTheme', () => {
  it('follows the system when no choice was made', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('lets an explicit choice override the system', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('keeps an explicit choice that agrees with the system', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
})
