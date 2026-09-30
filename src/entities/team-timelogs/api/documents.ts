/**
 * Every document reads hours through a `User` parent, never through the root
 * `Query.timelogs`.
 *
 * `Resolvers::TimelogResolver#validate_args!` permits a non-admin when
 * `has_parent?(object, args) || for_current_user?(args) || admin_user?`, and
 * `has_parent?` tests `object` generally rather than testing for a Group or a
 * Project — so a `User` parent satisfies it. The root field does not: it refuses
 * any username but the caller's own. That parent is the only door to somebody
 * else's hours, and the provider opens it for any authenticated reader.
 *
 * What comes back through it is redacted, not refused. `TimelogType` carries
 * `authorize :read_issuable`, so a node the reader may not open is spliced out
 * of the array with no null and no error — while `count` and `totalSpentTime`
 * are computed in SQL over the whole relation *before* that removal. That
 * difference is the instrument, and on this screen it is deliberately also the
 * answer.
 *
 * Three different scalar types, all measured against the real provider: the
 * roster is `[ID!]`, one person is `UserID!`, and the group filter is `GroupID`.
 * The first draft used `ID` for all three and the provider refused two of them.
 */

/**
 * One round of the window, for every person the team names at once.
 *
 * **One field, not one alias per person.** Measured: 26 points of the 250-point
 * budget for one person and 29 for sixteen, because complexity counts fields in
 * the document rather than rows in the answer. The roster stops being a
 * complexity problem at any size the connection's own hundred-node page permits.
 *
 * `count` and `totalSpentTime` are asked *here*, which the group page document
 * deliberately did not do. They are asked once per person per window, and asking
 * them beside the nodes rather than in a second request is a correctness gain
 * and not only a saving: a connection's aggregate and its nodes are the same
 * relation under the same range, so read in one field they cannot disagree.
 *
 * No `user { ... }` inside the entries: the node above already says whose hours
 * these are, so the person is known by position in the tree rather than repeated
 * on every one of them.
 *
 * No `project`, because `Timelog.project` is non-nullable while the connection's
 * items are not — asking for it is what replaces a whole entry with `null`.
 *
 * `users.pageInfo` is read for one purpose: to refuse. `$people` is the batch's
 * own length, so `hasNextPage` should always be false; if it is ever true the
 * provider capped the team, and a report that quietly omitted somebody would be
 * worse than one that failed.
 */
export const TEAM_HOURS_PAGE = `
  query TeamHoursPage($ids: [ID!], $people: Int!, $group: GroupID, $from: Time!, $to: Time!, $first: Int!) {
    users(ids: $ids, first: $people) {
      pageInfo {
        hasNextPage
      }
      nodes {
        id
        name
        username
        webUrl
        timelogs(
          groupId: $group
          startTime: $from
          endTime: $to
          sort: SPENT_AT_ASC
          first: $first
        ) {
          count
          totalSpentTime
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            spentAt
            timeSpent
          }
        }
      }
    }
  }
`

/** The alias one column's declaration comes back under, at this position. */
export function columnAlias(index: number): string {
  return `c${String(index)}`
}

export function columnFrom(index: number): string {
  return `f${String(index)}`
}

export function columnTo(index: number): string {
  return `t${String(index)}`
}

/** The alias one person's continued round comes back under, at this position. */
export function followAlias(index: number): string {
  return `a${String(index)}`
}

/** The variable one person's cursor is sent as. */
export function followCursor(index: number): string {
  return `c${String(index)}`
}

/** The variable one person's identifier is sent as. */
export function followUser(index: number): string {
  return `u${String(index)}`
}

/**
 * One person's period, column by column.
 *
 * The same instrument as the page document's aggregates, narrowed. They are
 * computed over the finder's relation after the time filter and before the
 * entries the reader may not read are removed from the nodes, so asking over one day's span
 * says how much was logged that day and how much of it is being withheld — which
 * is the only way to learn a withheld entry's day. The entry itself is
 * unrecoverable: it is spliced out of the array with no id and no `spentAt`.
 *
 * The group version passed `username:` on every alias, to narrow a group's
 * connection to one person. With a `User` parent the connection is already
 * theirs, so the argument goes — and with it the one place the period alias and
 * a column alias could have disagreed about who they were about.
 *
 * One person per request, not one grid. Measured at 7 points a column: a month
 * of days plus the period check scores 229, and forty columns score 292 and are
 * refused. A whole team's grid would be columns times people and is refused long
 * before it reaches a database.
 */
export function teamColumnProbe(count: number): string {
  const declarations = Array.from(
    { length: count },
    (_column, index) => `$${columnFrom(index)}: Time!, $${columnTo(index)}: Time!`,
  ).join(', ')
  const aliases = Array.from({ length: count }, (_column, index) => columnAliasFor(index)).join(
    '\n      ',
  )
  const extra = declarations === '' ? '' : `, ${declarations}`

  return `
  query TeamColumnProbe($user: UserID!, $group: GroupID, $from: Time!, $to: Time!${extra}) {
    user(id: $user) {
      id
      period: timelogs(groupId: $group, startTime: $from, endTime: $to, first: 1) {
        count
        totalSpentTime
      }
      ${aliases}
    }
  }
`
}

/**
 * The rest of the window, for whoever's first round did not hold it.
 *
 * A per-node cursor cannot travel back through `users(...)`: the connection
 * under each node has its own cursor space and the parent field has no argument
 * that reaches into it. So continuing is a different document, addressing one
 * person per alias.
 *
 * Like the column probe, this document is bounded by complexity, and the bound
 * is measured
 * rather than estimated: one alias scores 17, eight score 115, sixteen score 227
 * and twenty-four score 339 and are refused. So the batch is sixteen —
 * seventeen fits at 241 and leaves nine points, which is not enough to absorb a
 * field somebody adds later.
 *
 * No aggregates here. They are window-wide, so asking again returns the same
 * number while re-running a count and a sum over the whole month — and an
 * aggregate read at a later instant than the page it is compared against can
 * disagree for reasons that are not redaction.
 *
 * Aliases are positional and identifiers travel as variables, for two reasons: a
 * document assembled around provider data is a document that data can rewrite,
 * and an identifier is not a valid GraphQL name.
 */
export function teamHoursFollowing(count: number): string {
  const declarations = Array.from(
    { length: count },
    (_member, index) => `$${followUser(index)}: UserID!, $${followCursor(index)}: String`,
  ).join(', ')
  const aliases = Array.from({ length: count }, (_member, index) => followAliasFor(index)).join(
    '\n    ',
  )
  const extra = declarations === '' ? '' : `, ${declarations}`

  return `
  query TeamHoursFollowing($group: GroupID, $from: Time!, $to: Time!, $first: Int!${extra}) {
    ${aliases}
  }
`
}

function columnAliasFor(index: number): string {
  return `${columnAlias(index)}: timelogs(groupId: $group, startTime: $${columnFrom(index)}, endTime: $${columnTo(index)}, first: 1) {
        count
        totalSpentTime
      }`
}

function followAliasFor(index: number): string {
  return `${followAlias(index)}: user(id: $${followUser(index)}) {
      id
      name
      username
      webUrl
      timelogs(groupId: $group, startTime: $from, endTime: $to, sort: SPENT_AT_ASC, first: $first, after: $${followCursor(index)}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          spentAt
          timeSpent
        }
      }
    }`
}
