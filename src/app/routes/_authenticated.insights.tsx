import { createFileRoute } from '@tanstack/react-router'

import { InsightsPage } from '@/pages/insights'

export const Route = createFileRoute('/_authenticated/insights')({ component: InsightsPage })
