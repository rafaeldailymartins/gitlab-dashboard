export { gitLabTimelogGateway } from './api/gitlab-timelog-gateway'
export { myTimelogsQuery } from './api/queries'
export type { DayTotal } from './model/aggregate'
export type { TimelogGateway, TimelogPage } from './model/ports'
export { periodSummary, reportFrom } from './model/report'

export type { PeriodSummary } from './model/report'
export type { TimelogEntry } from './model/types'
export { TimelogGatewayProvider, useTimelogGateway } from './ui/gateway-provider'
