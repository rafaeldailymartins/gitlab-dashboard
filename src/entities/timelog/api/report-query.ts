import { queryOptions } from '@tanstack/react-query'

import { getTimelogReport } from './get-timelog-report'

export type TimelogReportParams = {
  days: number
  username?: string
}

export function timelogReportQueryOptions(params: TimelogReportParams) {
  return queryOptions({
    queryFn: () => getTimelogReport({ data: params }),
    queryKey: ['timelog-report', params.days, params.username ?? null],
  })
}
