export { gitLabGroupTimelogGateway } from './api/gitlab-group-timelog-gateway'
export {
  groupColumnsQuery,
  groupHoursQuery,
  groupProbeQuery,
  groupRosterQuery,
  groupSearchQuery,
} from './api/queries'
export type { Granularity, GridColumn, WeekBand } from './model/columns'
export type { CellKind, GridCell, GridRequest, GridRow, Shortfall, TeamGrid } from './model/grid'
export { teamGrid } from './model/grid'
export type {
  ColumnProbeAnswer,
  ColumnProbeQuery,
  DeclaredTotals,
  GroupHoursPage,
  GroupProbe,
  GroupTimelogGateway,
  RosterAnswer,
} from './model/ports'
export type { GroupReport } from './model/report'
export { groupReportFrom } from './model/report'
export { REFERENCE_SCHEDULE } from './model/types'
export type { GroupRef, GroupTimelogEntry, PeriodTotal, Person, RosterMember } from './model/types'
export type { ReaderWindow } from './model/window'
export { entriesWithin, readerWindow, spanColumns } from './model/window'
export type { WithheldDeclaration } from './model/withheld'
export { unplacedOf, withWithheld } from './model/withheld'
export { GroupTimelogGatewayProvider, useGroupTimelogGateway } from './ui/gateway-provider'
