import { createContext, type ReactNode } from 'react'

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
 *
 * `useTeamsGateway` arrives with the screen that calls it. Exporting a reader
 * nothing reads with would fail `bun run deadcode`, which is the gate that keeps
 * this slice from growing a surface ahead of its use.
 */
export function TeamsGatewayProvider({ children, gateway }: TeamsGatewayProviderProps) {
  return <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>
}
