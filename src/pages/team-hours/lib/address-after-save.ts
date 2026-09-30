import type { Team } from '@/entities/teams'

/**
 * The team the address should name once a save has landed, or null to leave it.
 *
 * The report's address survives the teams it names. A reader who deletes the
 * team they are reading — or who arrives on an address naming one they deleted
 * on an earlier visit and then makes a new one — is left with an address
 * pointing at nothing, which the screen reads as "this is not one of your
 * teams" (GROUP-14) and the picker draws as a trigger with no text in it at
 * all. That claim is about an address somebody else sent; said back to a reader
 * about the team they just removed, it reports their own action to them as a
 * mistake.
 *
 * So the save is the event the address follows. It is the only moment the list
 * is known to have changed and known to have been accepted, and it carries what
 * was actually stored.
 *
 * **Read from the written document, never from what was about to be written.**
 * `withTeam` returns the list unchanged when it is already at `MAX_TEAMS` or the
 * identifier is already used, and the write that follows still succeeds and still
 * closes the dialog as saved — so an address moved to a minted identifier would
 * name a team nothing created, manufacturing exactly the state this exists to
 * remove.
 *
 * An empty string is a real answer, not a failure: the reader deleted their last
 * team, and an address naming none is what invites them to make one.
 */
export function addressAfterSave(teams: readonly Team[], addressed: string): null | string {
  if (addressed === '' || teams.some((team) => team.id === addressed)) {
    return null
  }

  const [first] = teams

  return first?.id ?? ''
}
