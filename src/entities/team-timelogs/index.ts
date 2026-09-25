export { gitLabTeamTimelogGateway } from './api/gitlab-team-timelog-gateway'
export {
  groupQuery,
  groupSearchQuery,
  peopleSearchQuery,
  teamSuggestionsQuery,
} from './api/picker-queries'
export { teamColumnsQuery, teamHoursQuery } from './api/queries'
export type { Granularity, GridColumn, WeekBand } from './model/columns'
export type { CellKind, GridCell, GridRequest, GridRow, Shortfall, TeamGrid } from './model/grid'
export { teamGrid } from './model/grid'
export type { MemberIdentity } from './model/identity'
export { personOf } from './model/identity'
export type {
  ColumnProbeAnswer,
  ColumnProbeQuery,
  DeclaredTotals,
  SuggestionAnswer,
  TeamHoursPage,
  TeamTimelogGateway,
} from './model/ports'
export type { TeamReport } from './model/report'
export { teamReportFrom } from './model/report'
export { suggestionsFrom } from './model/suggestions'
export type {
  GroupRef,
  Member,
  PeriodTotal,
  Person,
  ReferenceSchedule,
  SuggestedMember,
  TeamTimelogEntry,
} from './model/types'
export { entriesWithin, readerWindow, spanColumns } from './model/window'
export type { WithheldDeclaration } from './model/withheld'
export { unplacedOf, withWithheld } from './model/withheld'
export { TeamTimelogGatewayProvider, useTeamTimelogGateway } from './ui/gateway-provider'
