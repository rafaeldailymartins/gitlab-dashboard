import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'

import { apiClient, sessionManager } from '@/app/lib/runtime'
import { gitLabTeamTimelogGateway, TeamTimelogGatewayProvider } from '@/entities/team-timelogs'
import { httpTeamsGateway, TeamsGatewayProvider } from '@/entities/teams'
import {
  rememberedTeam,
  rememberTeam,
  TeamHoursPage,
  type TeamSearch,
  teamSearchFrom,
} from '@/pages/team-hours'
import { toIsoDate } from '@/shared/lib/date'
import { persistentStorage } from '@/shared/lib/storage'

/**
 * The report is addressable, so a lead can send somebody the exact view.
 *
 * The address is validated here rather than inside the screen: it is untrusted
 * input, and a month that is not a month recovers to one that is rather than
 * failing. The reader's own zone is not available outside React, so the fallback
 * month is resolved in UTC — which only decides which month the screen opens on,
 * never how an entry is counted.
 *
 * An address naming no team is completed from the last one this reader chose,
 * by **redirecting** rather than by quietly filling it in. Filling it in would
 * leave the address disagreeing with the screen, and this screen's whole claim
 * is that what you are looking at is what you can send somebody else. A link
 * that does name a team is never overridden: somebody else's link outranks this
 * reader's habit.
 *
 * The group filter is deliberately not completed this way — see
 * `pages/team-hours/lib/remembered.ts` for why an empty filter is the only
 * honest default.
 *
 * The gateway is built here rather than in the runtime the root imports. This
 * route is code-split; the runtime is not, so a gateway constructed there would
 * put this screen's adapter in the bundle every reader downloads, including
 * everyone who never opens it.
 */
export const Route = createFileRoute('/_authenticated/team')({
  beforeLoad: ({ search }) => {
    const remembered = rememberedTeam(persistentStorage())

    if (search.team === '' && remembered !== '') {
      // TanStack Router signals a redirect by throwing its own marker object,
      // which is not an Error. That is the documented API, not a mistake.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ search: { ...search, team: remembered }, to: '/team' })
    }
  },
  component: TeamRoute,
  validateSearch: (search: Record<string, unknown>): TeamSearch =>
    teamSearchFrom(search, toIsoDate(new Date(), 'UTC')),
})

function TeamRoute() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const gateway = useMemo(() => gitLabTeamTimelogGateway(apiClient()), [])
  // The session is the identity: the teams store verifies a token GitLab signed
  // rather than being handed a credential that reads GitLab.
  const teams = useMemo(() => httpTeamsGateway(sessionManager()), [])

  return (
    <TeamsGatewayProvider gateway={teams}>
      <TeamTimelogGatewayProvider gateway={gateway}>
        <TeamHoursPage
          onChange={(next) => {
            void navigate({
              search: (current) => {
                const moved = { ...current, ...next }

                // Remembered from the address rather than from the change, so a
                // reader who only switched the month still confirms the team, and
                // one who arrived by somebody else's link adopts it.
                rememberTeam(persistentStorage(), moved.team)

                return moved
              },
            })
          }}
          search={search}
        />
      </TeamTimelogGatewayProvider>
    </TeamsGatewayProvider>
  )
}
