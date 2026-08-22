import { useId } from 'react'

import { cn } from '@/shared/lib/utils'
import { Label } from '@/shared/ui/label'

interface SelectFieldProps<T extends string> {
  readonly description?: string
  readonly label: string
  readonly onChange: (value: T) => void
  readonly options: readonly SelectOption<T>[]
  readonly value: T
}

interface SelectOption<T extends string> {
  readonly label: string
  readonly value: T
}

/**
 * A labelled native select.
 *
 * Native on purpose: the time zone list runs to several hundred entries, which
 * a custom listbox would have to virtualise to stay responsive, and browsers
 * already give a native select type-ahead and platform-correct behaviour on
 * touch devices.
 *
 * It is generic over the option type so callers receive their own union back
 * rather than a bare `string`. That removes the re-narrowing guard every caller
 * would otherwise need for a case a select cannot produce: the only values it
 * can emit are the ones rendered from `options`.
 */
export function SelectField<T extends string>({
  description,
  label,
  onChange,
  options,
  value,
}: SelectFieldProps<T>) {
  const id = useId()
  const descriptionId = `${id}-description`

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        aria-describedby={description === undefined ? undefined : descriptionId}
        className={cn(
          'h-9 w-full rounded-md border border-input bg-background px-3 text-sm',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        )}
        id={id}
        onChange={(event) => {
          // Safe by construction: a select only emits a value it rendered.
          onChange(event.target.value as T)
        }}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description === undefined ? null : (
        <p className="text-xs text-muted-foreground" id={descriptionId}>
          {description}
        </p>
      )}
    </div>
  )
}
