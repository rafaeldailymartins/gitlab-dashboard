import { useId } from 'react'

import type { DayTotal } from '@/entities/timelogs'

import { usePreferences } from '@/entities/preferences'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

import { feedScale } from '../lib/feed-scale'
import { useApproach } from '../lib/use-approach'
import { DayRow } from './day-row'

/** Roughly one row, so the browser can reserve the space it skips painting. */
const ROW_HEIGHT = '3.25rem'

const SKELETON_ROWS = [0, 1, 2, 3, 4]

interface DayFeedProps {
  /** True while an older page is on its way. */
  readonly appending: boolean
  readonly days: readonly DayTotal[]
  /** True when nothing has loaded yet, as opposed to nothing existing. */
  readonly loading: boolean
  readonly onLoadOlder: () => void
  /** True when the provider has nothing older than what is here. */
  readonly reachedBeginning: boolean
}

/**
 * The reader's history, newest day first.
 *
 * Rows carry `content-visibility: auto`, so the browser skips laying out and
 * painting the ones off screen while keeping their space reserved. That is the
 * work a virtualiser saves, without a virtualiser: rows here expand into their
 * work items, and a measured list whose items change height is exactly where a
 * virtualiser makes the list jump — the one thing UI-3 forbids.
 */
export function DayFeed({ appending, days, loading, onLoadOlder, reachedBeginning }: DayFeedProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground" id={headingId}>
        {m.day_feed_title()}
      </h2>
      <div className="overflow-hidden rounded-lg border bg-card">
        <FeedBody days={days} loading={loading} />
      </div>
      {loading || days.length === 0 ? null : (
        <FeedFooter
          appending={appending}
          onLoadOlder={onLoadOlder}
          reachedBeginning={reachedBeginning}
        />
      )}
    </section>
  )
}

function FeedBody({ days, loading }: Pick<DayFeedProps, 'days' | 'loading'>) {
  const { preferences } = usePreferences()

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {SKELETON_ROWS.map((row) => (
          <Skeleton className="h-8" key={row} />
        ))}
      </div>
    )
  }

  if (days.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">{m.day_feed_empty()}</p>
    )
  }

  const scale = feedScale(days, preferences.dailyTarget)

  return (
    <div>
      {days.map((day) => (
        <div
          className="cv-auto"
          key={day.date}
          style={{ containIntrinsicSize: `auto ${ROW_HEIGHT}` }}
        >
          <DayRow day={day} scale={scale} />
        </div>
      ))}
    </div>
  )
}

/**
 * The end of the feed: either the reason there is nothing more, or the way to
 * ask for it — automatically as the reader approaches, and by a real control for
 * anyone who is not scrolling.
 */
function FeedFooter({
  appending,
  onLoadOlder,
  reachedBeginning,
}: Omit<DayFeedProps, 'days' | 'loading'>) {
  const sentinel = useApproach(onLoadOlder, !reachedBeginning && !appending)

  // Not a live region: the report notice above is the page's one, and two of
  // them would announce over each other.
  if (reachedBeginning) {
    return <p className="text-center text-xs text-muted-foreground">{m.day_feed_complete()}</p>
  }

  return (
    <div className="flex flex-col items-center gap-2" ref={sentinel}>
      <Button disabled={appending} onClick={onLoadOlder} type="button" variant="outline">
        {appending ? m.day_feed_loading_older() : m.day_feed_load_older()}
      </Button>
    </div>
  )
}
