import { createFileRoute } from '@tanstack/react-router'

import { parseReportSearch } from '@/entities/timelog'
import { DayDetailPage } from '@/pages/day-detail'

export const Route = createFileRoute('/dias/$date')({
  component: DayDetailPage,
  validateSearch: parseReportSearch,
})
