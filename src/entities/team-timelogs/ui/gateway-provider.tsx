import { createContext, type ReactNode, useContext } from 'react'

import type { TeamTimelogGateway } from '../model/ports'

interface TeamTimelogGatewayProviderProps {
  readonly children: ReactNode
  readonly gateway: TeamTimelogGateway
}

const GatewayContext = createContext<null | TeamTimelogGateway>(null)

/**
 * Hands the gateway to whatever reads a team's hours.
 *
 * A context rather than an import, for the same reason the personal one is:
 * a screen can then be rendered against a fake gateway, and no screen has to
 * know how a gateway is built.
 */
export function TeamTimelogGatewayProvider({ children, gateway }: TeamTimelogGatewayProviderProps) {
  return <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>
}

export function useTeamTimelogGateway(): TeamTimelogGateway {
  const gateway = useContext(GatewayContext)

  if (!gateway) {
    throw new Error('useTeamTimelogGateway was called outside a TeamTimelogGatewayProvider')
  }

  return gateway
}
