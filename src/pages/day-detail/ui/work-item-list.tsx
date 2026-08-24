import type { WorkItemTotal } from '@/entities/timelogs'

import { m, useActiveLocale } from '@/shared/i18n'
import { formatHours } from '@/shared/lib/format'

/**
 * What the day went into, busiest first.
 *
 * A day with nothing logged says so rather than showing an empty frame: on this
 * screen the absence is the answer the reader came for.
 */
export function WorkItemList({ items }: { readonly items: readonly WorkItemTotal[] }) {
  const { locale } = useActiveLocale()

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.day_detail_nothing_logged()}</p>
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border bg-card">
      {items.map((item) => (
        <li
          className="flex flex-col gap-1 p-4"
          key={item.workItem?.reference ?? item.project.fullPath}
        >
          <div className="flex items-baseline gap-3">
            <span className="tabular w-14 shrink-0 text-right font-medium">
              {formatHours(item.hours, locale)}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                {m.hours_short()}
              </span>
            </span>
            {item.workItem ? (
              <a
                className="min-w-0 rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                href={item.workItem.webUrl}
                rel="noreferrer"
                target="_blank"
              >
                {item.workItem.title}
                <span className="sr-only"> {m.opens_in_new_tab()}</span>
              </a>
            ) : (
              <span className="text-muted-foreground italic">{m.day_unattributed()}</span>
            )}
          </div>
          <p className="pl-17 text-xs text-muted-foreground">
            {item.workItem?.reference ?? item.project.fullPath}
          </p>
        </li>
      ))}
    </ul>
  )
}
