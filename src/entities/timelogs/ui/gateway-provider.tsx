import { createContext, type ReactNode, useContext } from 'react'

import type { TimelogGateway } from '../model/ports'

interface TimelogGatewayProviderProps {
  readonly children: ReactNode
  readonly gateway: TimelogGateway
}

const GatewayContext = createContext<null | TimelogGateway>(null)

/**
 * Hands the gateway to whatever needs to read hours.
 *
 * It is a context rather than an import so that a screen can be rendered
 * against a fake gateway in a test, and so no screen has to know how a gateway
 * is built or which configuration it came from.
 */
export function TimelogGatewayProvider({ children, gateway }: TimelogGatewayProviderProps) {
  return <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>
}

export function useTimelogGateway(): TimelogGateway {
  const gateway = useContext(GatewayContext)

  if (!gateway) {
    throw new Error('useTimelogGateway was called outside a TimelogGatewayProvider')
  }

  return gateway
}
