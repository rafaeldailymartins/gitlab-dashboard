import { createContext, type ReactNode, useContext } from 'react'

import type { ViewerGateway } from '../model/ports'

interface ViewerGatewayProviderProps {
  readonly children: ReactNode
  readonly gateway: ViewerGateway
}

const GatewayContext = createContext<null | ViewerGateway>(null)

export function useViewerGateway(): ViewerGateway {
  const gateway = useContext(GatewayContext)

  if (!gateway) {
    throw new Error('useViewerGateway was called outside a ViewerGatewayProvider')
  }

  return gateway
}

/**
 * Hands the gateway to whatever needs to know who is signed in.
 *
 * A context rather than an import, for the same reason as the timelog one: a
 * screen can be rendered against a fake in a test, and no screen has to know how
 * a gateway is built or which configuration it came from.
 */
export function ViewerGatewayProvider({ children, gateway }: ViewerGatewayProviderProps) {
  return <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>
}
