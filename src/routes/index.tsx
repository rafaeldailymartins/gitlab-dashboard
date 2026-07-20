import { createFileRoute } from '@tanstack/react-router'

import { parseReportSearch } from '@/entities/timelog'
import { DashboardPage } from '@/pages/dashboard'

export const Route = createFileRoute('/')({
  component: DashboardPage,
  validateSearch: parseReportSearch,
})
