import { useQuery } from '@tanstack/react-query'

import type { Team, TeamsFailure } from '@/entities/teams'

import { TeamsError, teamsQuery, useTeamsGateway } from '@/entities/teams'

/** The reader's own teams, and why they are not there when they are not. */
export interface SavedTeams {
  readonly failure: null | TeamsFailure
  readonly loading: boolean
  readonly teams: readonly Team[]
}

/**
 * The teams this reader keeps.
 *
 * Read from the store on every visit rather than from the device, because a
 * team is a list of colleagues and this app keeps none of those where somebody
 * else could open the browser and find them. The cost is a picker that is empty
 * until the store answers; the screen asks the provider before it draws a figure
 * anyway, so nothing waits on this that was not already waiting.
 */
export function useSavedTeams(): SavedTeams {
  const gateway = useTeamsGateway()
  const { data, error, isPending } = useQuery(teamsQuery(gateway))

  return {
    failure: failureOf(error),
    loading: isPending,
    teams: data?.teams ?? [],
  }
}

/**
 * Why the store did not answer.
 *
 * Anything that is not the store's own refusal is reported as unreachable: the
 * reader's next move is the same either way, and inventing a more specific
 * cause from an unrecognised error would be a guess presented as a diagnosis.
 */
function failureOf(error: Error | null): null | TeamsFailure {
  if (!error) {
    return null
  }

  return error instanceof TeamsError ? error.failure : { kind: 'unavailable' }
}
