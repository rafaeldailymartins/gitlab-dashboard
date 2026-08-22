import { ExternalLink } from 'lucide-react'

import type { WorkItemTotal } from '@/entities/timelogs'

import { m, useActiveLocale } from '@/shared/i18n'
import { formatHours } from '@/shared/lib/format'

/**
 * One issue or merge request inside a day.
 *
 * The link opens GitLab in a new tab rather than navigating away: the reader is
 * reading their week, and losing that position to check an issue title is a
 * worse trade than a second tab.
 */
export function WorkItemRow({ item }: { readonly item: WorkItemTotal }) {
  const { locale } = useActiveLocale()

  return (
    <li className="flex items-baseline gap-3 py-1.5 text-sm">
      <span className="tabular w-14 shrink-0 text-right font-medium">
        {formatHours(item.hours, locale)}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{m.hours_short()}</span>
      </span>
      {item.workItem ? (
        <a
          className="group flex min-w-0 items-baseline gap-1.5 rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          href={item.workItem.webUrl}
          rel="noreferrer"
          target="_blank"
        >
          <span className="truncate">{item.workItem.title}</span>
          <ExternalLink aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <span className="sr-only">{m.opens_in_new_tab()}</span>
        </a>
      ) : (
        <span className="min-w-0 truncate text-muted-foreground italic">
          {m.day_unattributed()}
        </span>
      )}
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {item.workItem?.reference ?? item.project.fullPath}
      </span>
    </li>
  )
}
