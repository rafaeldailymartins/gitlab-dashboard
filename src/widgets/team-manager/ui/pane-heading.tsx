import { ArrowLeft } from 'lucide-react'

import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

interface PaneHeadingProps {
  /** Set when the heading is the pane's landmark, so `aria-labelledby` can name it. */
  readonly id?: string
  readonly onBack: () => void
  readonly title: string
}

/**
 * A pane's title with the way out of it beside it.
 *
 * The arrow comes first and is an icon alone: it undoes the click that opened
 * this pane, and a labelled button beside a title saying the same thing would be
 * the sentence twice.
 *
 * Its own module rather than a second export from the pane that switches
 * between them — the starter needs it too, and the two importing each other is
 * the cycle `dependency-cruiser` refuses.
 */
export function PaneHeading({ id, onBack, title }: PaneHeadingProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label={m.teams_back()}
        className="-ml-1.5 shrink-0 text-muted-foreground"
        onClick={onBack}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <ArrowLeft aria-hidden />
      </Button>
      <h2 className="truncate text-sm font-semibold" id={id}>
        {title}
      </h2>
    </div>
  )
}
