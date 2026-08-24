import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center')
  })

  it('drops falsy values so conditionals can be inlined', () => {
    expect(cn('flex', false, undefined, null, '', 'gap-2')).toBe('flex gap-2')
  })

  it('accepts arrays and conditional objects', () => {
    expect(cn(['flex', 'gap-2'], { 'font-bold': true, italic: false })).toBe('flex gap-2 font-bold')
  })

  it('lets the later of two conflicting Tailwind utilities win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm text-muted-foreground', 'text-foreground')).toBe('text-sm text-foreground')
  })

  it('returns an empty string when given nothing', () => {
    expect(cn()).toBe('')
  })
})
