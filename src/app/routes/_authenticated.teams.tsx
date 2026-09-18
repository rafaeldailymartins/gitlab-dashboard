import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'

import { apiClient, sessionManager } from '@/app/lib/runtime'
import { gitLabTeamTimelogGateway, TeamTimelogGatewayProvider } from '@/entities/team-timelogs'
import { httpTeamsGateway, TeamsGatewayProvider } from '@/entities/teams'
import { TeamsPage } from '@/pages/teams'

/**
 * Where a reader builds the lists the report is about.
 *
 * Both gateways are built here rather than in the runtime the root imports.
 * This route is code-split; the runtime is not, so a gateway constructed there
 * would put this screen's adapters in the bundle every reader downloads,
 * including everyone who never opens it.
 *
 * It carries no search parameters. There is nothing here worth sending somebody
 * else — these are this reader's own teams, private to them — so the address is
 * the screen and nothing more.
 */
export const Route = createFileRoute('/_authenticated/teams')({
  component: TeamsRoute,
})

function TeamsRoute() {
  const gateway = useMemo(() => gitLabTeamTimelogGateway(apiClient()), [])
  // The session is the identity: the teams store asks GitLab who is calling
  // rather than being handed a credential that reads GitLab.
  const teams = useMemo(() => httpTeamsGateway(sessionManager()), [])

  return (
    <TeamsGatewayProvider gateway={teams}>
      <TeamTimelogGatewayProvider gateway={gateway}>
        <TeamsPage />
      </TeamTimelogGatewayProvider>
    </TeamsGatewayProvider>
  )
}
