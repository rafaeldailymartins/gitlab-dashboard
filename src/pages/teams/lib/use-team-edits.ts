import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Team, TeamsDocument, TeamsFailure } from '@/entities/teams'

import { TEAMS_KEY, TeamsError, teamsQuery, useTeamsGateway } from '@/entities/teams'

/** What the last save did, which is the one thing this screen has to announce. */
export type SaveState =
  /** Somebody else changed the document; what is on screen is now theirs. */
  | { readonly failure: TeamsFailure; readonly kind: 'failed' }
  | { readonly kind: 'changed-elsewhere' }
  /** Nothing has been changed yet in this visit. */
  | { readonly kind: 'idle' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'saving' }

export interface TeamEdits {
  /** Applies a change and saves it. Every edit is a save; there is no draft. */
  readonly apply: (change: TeamsChange) => void
  readonly loading: boolean
  readonly state: SaveState
  readonly teams: readonly Team[]
}

/** A change to the reader's whole list of teams. */
type TeamsChange = (teams: readonly Team[]) => readonly Team[]

const NOTHING: TeamsDocument = { etag: null, teams: [] }

/**
 * The reader's teams, and every change to them.
 *
 * Saved on every edit rather than behind a button. A team is a short list built
 * by clicking names, and a screen that collected those clicks into an unsaved
 * draft would lose them to a closed tab — and would have to explain, on a screen
 * whose whole job is a list, what "unsaved" means.
 *
 * Nothing is applied optimistically. The document carries a version, and a
 * write that loses the race is answered with the current document rather than
 * accepted; an optimistic list would show the reader their own change for the
 * moment before it was replaced by somebody else's, which is worse than waiting.
 *
 * The write path never falls back. A change that did not reach the store did not
 * happen, and queueing one for replay would reintroduce exactly the clobber the
 * version prevents.
 */
export function useTeamEdits(): TeamEdits {
  const gateway = useTeamsGateway()
  const client = useQueryClient()
  const { data, isPending } = useQuery(teamsQuery(gateway))
  const save = useMutation({
    mutationFn: async (teams: readonly Team[]) =>
      gateway.write({ etag: data?.etag ?? null, teams }),
    onError: (error) => {
      const current = conflictOf(error)

      if (current) {
        client.setQueryData(TEAMS_KEY, current)
      }
    },
    onSuccess: (written) => {
      client.setQueryData(TEAMS_KEY, written)
    },
  })

  return {
    apply: (change) => {
      save.mutate(change(data?.teams ?? NOTHING.teams))
    },
    loading: isPending,
    state: stateOf(save.error, save.isPending, save.isSuccess),
    teams: data?.teams ?? NOTHING.teams,
  }
}

/** The document somebody else wrote, when that is why this write was refused. */
function conflictOf(error: Error): null | TeamsDocument {
  if (error instanceof TeamsError && error.failure.kind === 'conflict') {
    return error.failure.current
  }

  return null
}

function failureOf(error: Error): TeamsFailure {
  return error instanceof TeamsError ? error.failure : { kind: 'unavailable' }
}

/**
 * What to say about the last save.
 *
 * A conflict is not a failure to the reader: their change did not land, but the
 * reason is that the list in front of them is now somebody else's newer one —
 * which they need to see before deciding what to do, and which the query cache
 * already holds by the time this is read.
 */
function stateOf(error: Error | null, saving: boolean, saved: boolean): SaveState {
  if (saving) {
    return { kind: 'saving' }
  }

  if (error) {
    return conflictOf(error)
      ? { kind: 'changed-elsewhere' }
      : { failure: failureOf(error), kind: 'failed' }
  }

  return saved ? { kind: 'saved' } : { kind: 'idle' }
}
