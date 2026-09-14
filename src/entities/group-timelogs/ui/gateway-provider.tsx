import { createContext, type ReactNode, useContext } from 'react'

import type { GroupTimelogGateway } from '../model/ports'

interface GroupTimelogGatewayProviderProps {
  readonly children: ReactNode
  readonly gateway: GroupTimelogGateway
}

const GatewayContext = createContext<GroupTimelogGateway | null>(null)

/**
 * Hands the gateway to whatever reads a group's hours.
 *
 * A context rather than an import, for the same reason the personal one is:
 * a screen can then be rendered against a fake gateway, and no screen has to
 * know how a gateway is built.
 */
export function GroupTimelogGatewayProvider({
  children,
  gateway,
}: GroupTimelogGatewayProviderProps) {
  return <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>
}

export function useGroupTimelogGateway(): GroupTimelogGateway {
  const gateway = useContext(GatewayContext)

  if (!gateway) {
    throw new Error('useGroupTimelogGateway was called outside a GroupTimelogGatewayProvider')
  }

  return gateway
}
