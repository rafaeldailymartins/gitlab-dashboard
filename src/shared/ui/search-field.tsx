import { Search } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/input'

interface SearchFieldProps {
  readonly className?: string
  /** What this searches, spoken. There is no visible label; see below. */
  readonly label: string
  readonly onChange: (typed: string) => void
  readonly placeholder: string
  readonly value: string
}

/**
 * A search box with the magnifier inside it.
 *
 * Named by `aria-label` rather than by a label above it, which is the one place
 * this app allows that: a search field's placeholder and its icon already say
 * what it searches, and a label over it would be the same words a third time.
 * The name still reaches the accessibility tree, so it is a name and not a
 * placeholder pretending to be one.
 *
 * The icon takes no pointer events and is `aria-hidden`, so the click lands on
 * the input underneath it and the magnifier is an affordance rather than a
 * control the keyboard cannot reach.
 */
export function SearchField({ className, label, onChange, placeholder, value }: SearchFieldProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        aria-label={label}
        className="pl-8"
        onChange={(event) => {
          onChange(event.target.value)
        }}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </div>
  )
}
