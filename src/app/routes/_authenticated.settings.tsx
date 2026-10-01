import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'

import { apiClient, sessionManager } from '@/app/lib/runtime'
import { gitLabTeamTimelogGateway, TeamTimelogGatewayProvider } from '@/entities/team-timelogs'
import { httpTeamsGateway, TeamsGatewayProvider } from '@/entities/teams'
import { SettingsPage } from '@/pages/settings'

/**
 * The preferences, and the second way into the teams a reader keeps.
 *
 * Both gateways are built here rather than in the runtime the root imports.
 * This route is code-split; the runtime is not, so a gateway constructed there
 * would put these adapters in the bundle every reader downloads, including
 * everyone who never opens this screen. The dialog they serve is loaded only
 * once it is asked for, so the cost of arriving here is the two factories and
 * not the surface.
 */
export const Route = createFileRoute('/_authenticated/settings')({ component: SettingsRoute })

function SettingsRoute() {
  const gateway = useMemo(() => gitLabTeamTimelogGateway(apiClient()), [])
  // The session is the identity: the teams store verifies a token GitLab signed
  // rather than being handed a credential that reads GitLab.
  const teams = useMemo(() => httpTeamsGateway(sessionManager()), [])

  return (
    <TeamsGatewayProvider gateway={teams}>
      <TeamTimelogGatewayProvider gateway={gateway}>
        <SettingsPage />
      </TeamTimelogGatewayProvider>
    </TeamsGatewayProvider>
  )
}
