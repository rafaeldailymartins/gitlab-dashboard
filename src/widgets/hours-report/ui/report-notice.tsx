import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

import type { HoursReport } from '../lib/use-hours-report'

/**
 * What the report is doing, when that is worth saying.
 *
 * A failure never removes figures that are already on screen: cached hours stay
 * readable and the reason appears beside them, with a way to try again.
 */
export function ReportNotice({ report }: { readonly report: HoursReport }) {
  if (report.failure) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" role="status">
        <span>{failureMessage(report.failure.kind)}</span>
        <Button onClick={report.retry} size="sm" type="button" variant="outline">
          {m.report_retry()}
        </Button>
      </p>
    )
  }

  return (
    <p className="text-sm text-muted-foreground" role="status">
      {report.isRefreshing ? m.report_refreshing() : m.report_up_to_date()}
    </p>
  )
}

function failureMessage(kind: 'rejected' | 'unauthorized' | 'unavailable'): string {
  if (kind === 'unauthorized') {
    return m.report_failed_unauthorized()
  }

  return kind === 'rejected' ? m.report_failed_rejected() : m.report_failed_unavailable()
}
