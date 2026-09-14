import { m } from '@/shared/i18n'

import type { HoursReport } from './use-hours-report'

/**
 * What the personal report could not read, as sentences.
 *
 * Separate from the control that shows them because a second screen — the
 * team's — has its own reasons a figure can be short and reuses the same single
 * status region to say them. When nothing was withheld there is nothing to add,
 * and nothing is added: an empty or zero notice would be noise on every
 * ordinary visit.
 */
export function withheldNotices(report: HoursReport): string[] {
  const notices: string[] = []

  if (report.withoutProject > 0) {
    notices.push(m.report_without_project({ count: report.withoutProject }))
  }

  if (report.unread > 0) {
    notices.push(m.report_unread({ count: report.unread }))
  }

  return notices
}
