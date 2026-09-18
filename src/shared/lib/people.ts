/** Somebody with a display name and a handle, which is all ordering needs. */
export interface Named {
  readonly name: string
  readonly username: string
}

/**
 * Ordered by name, then by username to break a tie between two people who share
 * one.
 *
 * Plain code-unit comparison rather than `localeCompare`: the model may not read
 * a locale, and an ordering that depended on the ambient one would put a domain
 * test at the mercy of the machine running it. Ordering for a human to read is
 * presentation, and the table does it in the interface.
 *
 * It sits in shared, like `duration.ts`, only because two entity slices need it
 * and FSD forbids one reaching into the other: the report orders the rows it
 * drew, and the team editor orders the list the reader is building.
 */
export function byNameThenUsername(left: Named, right: Named): number {
  if (left.name === right.name) {
    return left.username < right.username ? -1 : 1
  }

  return left.name < right.name ? -1 : 1
}
