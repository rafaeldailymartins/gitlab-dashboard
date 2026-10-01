import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import type { GraphQLFailure } from '@/shared/api'

import { usePreferences } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import { toIsoDate } from '@/shared/lib/date'
import { formatShortDate, formatTimeOfDay } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'

interface SyncControlProps {
  /** Sentences about what the answer could not tell us, in the order to read them. */
  readonly notices: readonly string[]
  readonly status: SyncStatus
}

/** The part of a report this control needs. Any report satisfies it. */
interface SyncStatus {
  readonly failure: GraphQLFailure | null
  readonly sync: () => void
  readonly syncedAt: Date | null
  readonly syncing: boolean
}

/**
 * When the hours on screen last came from GitLab, and the way to ask again.
 *
 * One region for all four states — never synced, syncing, synced at a time, and
 * failed — because a screen reader should hear one status per screen, and
 * because a failure is not a reason to add a second button that makes the same
 * request. Figures already on screen are never removed by any of it: a failed
 * sync leaves both the hours and the time they arrived exactly where they were.
 *
 * The text sits before the button so that the button, pinned to the end of the
 * row, does not move under the reader's pointer when the state changes: the
 * text grows leftwards into empty space instead.
 */
export function SyncControl({ notices, status }: SyncControlProps) {
  const { preferences } = usePreferences()
  const { locale } = useActiveLocale()
  const [presses, setPresses] = useState(0)

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <p className="text-right text-xs text-muted-foreground" role="status">
        {statusOf({ notices, status }, locale, preferences.timeZone)}
      </p>
      {/* Deliberately never disabled: disabling blurs the control, which would
          take focus off it at the moment a keyboard reader pressed it. A second
          press while a request is in flight is deduplicated by the query. */}
      <Button
        aria-label={m.sync_action()}
        onClick={() => {
          setPresses((count) => count + 1)
          status.sync()
        }}
        size="icon-sm"
        title={m.sync_action()}
        type="button"
        variant="ghost"
      >
        {/* The key is the press count, so a second press restarts the turn:
            a CSS animation on an element that stayed mounted would not. */}
        <RefreshCw aria-hidden className={turnClass(status.syncing, presses)} key={presses} />
      </Button>
    </div>
  )
}

function failureMessage(kind: 'rejected' | 'unauthorized' | 'unavailable'): string {
  if (kind === 'unauthorized') {
    return m.report_failed_unauthorized()
  }

  return kind === 'rejected' ? m.report_failed_rejected() : m.report_failed_unavailable()
}

/**
 * The clock time the hours arrived, and the date too when that was not today.
 *
 * Which day it was is decided in the reader's own zone, so a sync at half past
 * eleven at night in São Paulo is not called yesterday because UTC has already
 * turned over.
 */
function lastSync(syncedAt: Date, locale: string, timeZone: string): string {
  const time = formatTimeOfDay(syncedAt, locale, timeZone)
  const day = toIsoDate(syncedAt, timeZone)

  return day === toIsoDate(new Date(), timeZone)
    ? m.sync_updated_at({ time })
    : m.sync_updated_on({ date: formatShortDate(day, locale), time })
}

/**
 * The sync state, and what the answer could not tell us.
 *
 * One region rather than two: a reader hears one status per screen, and what is
 * missing from a figure belongs beside the figure's own state, not in a notice of
 * its own. When nothing was withheld there is nothing to add, and nothing is
 * added — an empty or zero notice would be noise on every ordinary visit.
 */
function statusOf(props: SyncControlProps, locale: string, timeZone: string): string {
  return [syncState(props.status, locale, timeZone), ...props.notices].join(' ')
}

function syncState(status: SyncStatus, locale: string, timeZone: string): string {
  if (status.failure) {
    return failureMessage(status.failure.kind)
  }

  if (status.syncing) {
    return m.sync_in_progress()
  }

  return status.syncedAt === null ? m.sync_never() : lastSync(status.syncedAt, locale, timeZone)
}

/**
 * How the icon turns: continuously while a request is in flight, once for a
 * press GitLab answered immediately, and not at all for a reader who has asked
 * for reduced motion — for whom the text is the whole feedback.
 */
function turnClass(syncing: boolean, presses: number): string | undefined {
  if (syncing) {
    return 'motion-safe:animate-spin'
  }

  return presses > 0 ? 'motion-safe:animate-spin-once' : undefined
}
