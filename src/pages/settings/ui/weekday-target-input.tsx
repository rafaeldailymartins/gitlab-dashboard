import { useId, useState } from 'react'

import { isValidTargetHours, MAX_TARGET_HOURS } from '@/entities/preferences'
import { m } from '@/shared/i18n'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

interface WeekdayTargetInputProps {
  readonly hours: number
  readonly label: string
  readonly onCommit: (hours: number) => void
}

/**
 * One weekday's target.
 *
 * The typed text is held locally so a reader can clear the field on the way to
 * a new value; only a value the domain accepts is committed, and anything else
 * shows the allowed range instead of being silently dropped.
 */
export function WeekdayTargetInput({ hours, label, onCommit }: WeekdayTargetInputProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [draft, setDraft] = useState(String(hours))
  const parsed = Number(draft)
  const isValid = draft.trim() !== '' && isValidTargetHours(parsed)

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground" htmlFor={id}>
        {label}
      </Label>
      <Input
        aria-describedby={isValid ? undefined : errorId}
        aria-invalid={!isValid}
        className="tabular"
        id={id}
        inputMode="decimal"
        max={MAX_TARGET_HOURS}
        min={0}
        onChange={(event) => {
          setDraft(event.target.value)

          const next = Number(event.target.value)

          if (event.target.value.trim() !== '' && isValidTargetHours(next)) {
            onCommit(next)
          }
        }}
        step={0.5}
        type="number"
        value={draft}
      />
      {isValid ? null : (
        <p className="text-xs text-destructive" id={errorId}>
          {m.daily_target_invalid({ max: MAX_TARGET_HOURS })}
        </p>
      )}
    </div>
  )
}
