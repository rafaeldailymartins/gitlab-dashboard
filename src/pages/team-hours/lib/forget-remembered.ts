import type { SavedTeams } from './use-saved-teams'

/**
 * Whether the address names a team this reader remembered and no longer has.
 *
 * The route completes a bare address from the remembered identifier before the
 * list exists — it reads the device, and the teams are read from the store later,
 * on this screen. So a team deleted from Settings, on another device or in
 * another tab leaves the next visit redirected into an address naming nothing,
 * and without this every visit after it says "that team is not one of yours"
 * over a picker with no text in it. GROUP-20 forbids exactly that.
 *
 * **Only what was remembered is forgotten.** An address somebody sent that names
 * a team the reader does not have still says so (GROUP-14), and it cannot equal
 * the remembered identifier unless it names a team the reader chose themselves.
 * Forgetting on any unknown team would turn a colleague's link into a silent
 * redirect to the reader's own first team.
 *
 * **Only once the list has answered.** While it is loading it is empty, and when
 * the store refused it is empty too; forgetting then would wipe a good memory
 * over a network blip.
 */
export function forgetsRemembered(
  saved: SavedTeams,
  addressed: string,
  remembered: string,
): boolean {
  if (saved.loading || saved.failure !== null) {
    return false
  }

  if (addressed === '' || addressed !== remembered) {
    return false
  }

  return !saved.teams.some((team) => team.id === addressed)
}
