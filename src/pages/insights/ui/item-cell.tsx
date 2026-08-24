import type { ItemTotal } from '@/entities/timelogs'

import { m } from '@/shared/i18n'

/**
 * A work item as a link back to GitLab, or a plain note when the time was
 * logged without one.
 */
export function ItemCell({ item }: { readonly item: ItemTotal }) {
  if (!item.workItem) {
    return <span className="text-muted-foreground italic">{m.day_unattributed()}</span>
  }

  return (
    <a
      className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      href={item.workItem.webUrl}
      rel="noreferrer"
      target="_blank"
    >
      {item.workItem.title}
      <span className="sr-only"> {m.opens_in_new_tab()}</span>
    </a>
  )
}
