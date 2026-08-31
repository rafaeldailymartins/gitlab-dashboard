import { ExternalLink } from 'lucide-react'

import { projectPath, type WorkItemTotal } from '@/entities/timelogs'
import { m } from '@/shared/i18n'
import { HourFigure } from '@/shared/ui/hour-figure'

/**
 * One issue or merge request inside a day.
 *
 * The link opens GitLab in a new tab rather than navigating away: the reader is
 * reading their week, and losing that position to check an issue title is a
 * worse trade than a second tab.
 *
 * The row wraps rather than competing for width. A GitLab reference can be sixty
 * characters of group path, and holding it on the same line left the title at
 * zero width on a phone — which an acceptance run at 375 pixels is how we found
 * out.
 */
export function WorkItemRow({ item }: { readonly item: WorkItemTotal }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 py-1.5 text-sm">
      <span className="tabular w-14 shrink-0 text-right font-medium">
        <HourFigure
          hours={item.hours}
          unitClassName="ml-0.5 text-xs font-normal text-muted-foreground"
        />
      </span>
      {item.workItem ? (
        <a
          className="group flex min-w-0 flex-1 items-baseline gap-1.5 rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          href={item.workItem.webUrl}
          rel="noreferrer"
          target="_blank"
        >
          <span className="truncate">{item.workItem.title}</span>
          <ExternalLink aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <span className="sr-only">{m.opens_in_new_tab()}</span>
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-muted-foreground italic">
          {m.day_unattributed()}
        </span>
      )}
      <span className="w-full truncate pl-17 text-xs text-muted-foreground sm:w-auto sm:pl-0">
        {item.workItem?.reference ?? projectPath(item.project)}
      </span>
    </li>
  )
}
