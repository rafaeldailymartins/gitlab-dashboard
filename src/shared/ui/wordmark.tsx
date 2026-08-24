import { m } from '@/shared/i18n'

/**
 * The product's name beside the mark the favicon draws, so the browser tab and
 * the screen agree on what this is.
 *
 * The mark is decorative: the name sits next to it as real text, so naming the
 * graphic as well would make a screen reader say it twice.
 */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg aria-hidden className="size-6 shrink-0" viewBox="0 0 32 32">
        <rect className="fill-primary" height="32" rx="8" width="32" />
        <g className="fill-primary-foreground">
          <rect height="8" rx="1.5" width="4" x="7" y="17" />
          <rect height="13" rx="1.5" width="4" x="14" y="12" />
          <rect height="18" rx="1.5" width="4" x="21" y="7" />
        </g>
      </svg>
      <span className="font-semibold tracking-tight">{m.app_name()}</span>
    </span>
  )
}
