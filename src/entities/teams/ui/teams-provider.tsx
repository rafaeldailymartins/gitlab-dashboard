import { createContext, type ReactNode, useContext } from 'react'

import type { TeamsGateway } from '../model/ports'

interface TeamsGatewayProviderProps {
  readonly children: ReactNode
  readonly gateway: TeamsGateway
}

const GatewayContext = createContext<null | TeamsGateway>(null)

/**
 * Hands the teams gateway to whatever reads or edits them.
 *
 * A context rather than an import, for the reason the other gateways are: a
 * screen can then be rendered against a fake, and no screen has to know how a
 * gateway is built — which here also means no screen has to know that one
 * exists on a server at all.
 */
export function TeamsGatewayProvider({ children, gateway }: TeamsGatewayProviderProps) {
  return <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>
}

export function useTeamsGateway(): TeamsGateway {
  const gateway = useContext(GatewayContext)

  if (!gateway) {
    throw new Error('useTeamsGateway was called outside a TeamsGatewayProvider')
  }

  return gateway
}
