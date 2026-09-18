import { type GridRow, personOf } from '@/entities/team-timelogs'

/**
 * What a row is called, and where its name comes from.
 *
 * The provider's answer when it resolved the person, the stored name otherwise.
 * The provider's is preferred because a rename is somebody changing their own
 * name and the screen should show it; the stored one is what makes a row for
 * somebody the provider would not resolve say who it is about rather than
 * showing an identifier.
 *
 * One function so the table, its ordering and its person column cannot disagree
 * about what a row is called — which would put rows in an order the reader
 * cannot see the logic of.
 */
export function rowName(row: GridRow): string {
  return personOf(row.identity)?.name ?? row.member.name
}

/** The handle beside the name, from the same answer for the same reason. */
export function rowUsername(row: GridRow): string {
  return personOf(row.identity)?.username ?? row.member.username
}
