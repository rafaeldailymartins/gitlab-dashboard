export { TEAMS_KEY, teamsQuery } from './api/queries'
export { httpTeamsGateway } from './api/teams-gateway'
export {
  newTeam,
  withMember,
  withName,
  withoutMember,
  withoutTeam,
  withTeam,
  withUpdated,
} from './model/edits'
export type { TeamsDocument, TeamsFailure, TeamsGateway } from './model/ports'
export { TeamsError } from './model/ports'
export type { Team, TeamMember } from './model/team'
export { isValidTeamName, MAX_NAME_LENGTH, MAX_TEAMS, orderedMembers } from './model/team'
export { TeamsGatewayProvider, useTeamsGateway } from './ui/teams-provider'
