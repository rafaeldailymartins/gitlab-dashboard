/**
 * Every document goes through `Query.group(fullPath:)`, never through the root
 * `Query.timelogs(groupId:)`.
 *
 * `Timelogs::TimelogsFinder#by_group` performs no authorization check of its
 * own, so the root field will happily compute `count` and `totalSpentTime` for a
 * group the reader cannot read. `GroupType` carries `authorize :read_group`,
 * which turns "you may not see this" into a clean `group: null` the adapter can
 * classify instead of a number it must not trust.
 */

/**
 * One page of the window's entries.
 *
 * No `project`: `Timelog.project` is non-nullable while the connection's items
 * are not, so asking for it is what replaces a whole entry with `null` when the
 * provider will not resolve it. Not asking means the resolver that fails is
 * never reached, and this screen needs no project.
 *
 * No `count` and no `totalSpentTime` either. Both run an aggregate over the
 * entire unpaginated window in the database, and a month can be thirty pages;
 * they are read once, by `GROUP_MONTH_PROBE`.
 *
 * `id` is selected so two answers about the same page could be reconciled
 * exactly rather than by position.
 *
 * `sort` is stated rather than left to the default. The default happens to be
 * the same, and an unstated default is a landmine; oldest-first also fills the
 * matrix left to right, so a partial read looks like a partial month.
 */
export const GROUP_HOURS_PAGE = `
  query GroupHoursPage($fullPath: ID!, $from: Time!, $to: Time!, $first: Int!, $after: String) {
    group(fullPath: $fullPath) {
      fullPath
      name
      timelogs(startTime: $from, endTime: $to, sort: SPENT_AT_ASC, first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          spentAt
          timeSpent
          user {
            id
            name
            username
            webUrl
          }
        }
      }
    }
  }
`

/**
 * The group's membership, so somebody who logged nothing still gets a row.
 *
 * `relations` is passed explicitly. The provider's default is
 * `[DIRECT, INHERITED]`, and inherited membership walks *up* the tree — for a
 * squad inside a company group that hands the reader everyone with access to the
 * company. `DESCENDANTS` walks down instead, which is what "my squad and its
 * subgroups" means and matches the entries `Group.timelogs` returns.
 */
export const GROUP_ROSTER = `
  query GroupRoster($fullPath: ID!, $first: Int!, $after: String) {
    group(fullPath: $fullPath) {
      fullPath
      name
      maxAccessLevel {
        integerValue
        stringValue
      }
      groupMembers(relations: [DIRECT, DESCENDANTS], first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          accessLevel {
            integerValue
            stringValue
          }
          user {
            id
            name
            username
            webUrl
            state
            bot
          }
        }
      }
    }
  }
`

/**
 * The groups the reader may open, for the picker.
 *
 * `allAvailable: false` restricts the answer to groups the reader is authorized
 * in, which is broader than their direct memberships: it finds a subgroup for
 * somebody who joined at an ancestor, and that is the archetypal team lead.
 */
export const MY_GROUPS = `
  query MyGroups($search: String, $first: Int!) {
    groups(search: $search, allAvailable: false, first: $first) {
      nodes {
        fullPath
        name
      }
    }
  }
`

/** The alias one column's totals come back under, at the given position. */
export function columnAlias(index: number): string {
  return `c${String(index)}`
}

/** The variable one column's opening instant is sent as. */
export function columnFrom(index: number): string {
  return `f${String(index)}`
}

/** The variable one column's closing instant is sent as. */
export function columnTo(index: number): string {
  return `t${String(index)}`
}

/**
 * One person's period, column by column.
 *
 * The same instrument as `groupMonthProbe`, narrowed. `count` and
 * `totalSpentTime` are computed over the finder's relation after the time
 * filter and before the reader's own entries are removed from the nodes, so
 * asking over one day's span says how much was logged that day and how much of
 * it is being withheld — which is the only way to learn a withheld entry's day.
 * The entry is spliced out of the array: it has no id and no `spentAt` to read.
 *
 * One person per request, not one grid. Each alias costs 7 of GitLab's 250-point
 * complexity budget, so a month of day columns plus the period check is
 * 32 x 7 = 224 and fits with room to spare, while a whole team's grid —
 * 31 columns x 40 people — scores over eight thousand and is refused before it
 * reaches the database. It would also blow the 10,000-character document limit.
 *
 * The spans travel as variables, so they cost nothing against that limit and no
 * instant is ever interpolated into the document.
 *
 * Aliases are positional for the same reason `groupMonthProbe`'s are: a column
 * key is `2026-05-12` or `2026-W20`, and neither is a valid GraphQL name.
 */
export function groupColumnProbe(count: number): string {
  const declarations = Array.from(
    { length: count },
    (_column, index) => `$${columnFrom(index)}: Time!, $${columnTo(index)}: Time!`,
  ).join(', ')
  const aliases = Array.from({ length: count }, (_column, index) => columnAliasFor(index)).join(
    '\n      ',
  )
  const extra = declarations === '' ? '' : `, ${declarations}`

  return `
  query GroupColumnProbe($fullPath: ID!, $user: String!, $from: Time!, $to: Time!${extra}) {
    group(fullPath: $fullPath) {
      fullPath
      name
      period: timelogs(startTime: $from, endTime: $to, username: $user, first: 1) {
        count
        totalSpentTime
      }
      ${aliases}
    }
  }
`
}

/**
 * The window's own arithmetic, and each person's share of it.
 *
 * `count` and `totalSpentTime` are computed in the database over the whole
 * unpaginated relation *before* the provider removes the entries the reader may
 * not read — and it removes them from the node array silently, with no null and
 * no error. The difference between what this reports and what the pages carried
 * is the only instrument that can see that removal at all.
 *
 * The per-person aliases are what let the difference be attributed to a row.
 * Without them a shortfall can only be stated for the group, on a screen whose
 * whole purpose is comparing one person against another.
 *
 * Built rather than written out because the aliases depend on who is in the
 * group. `first: 1` because the nodes are not wanted, and zero is rejected.
 *
 * Each username travels as a **variable**, never interpolated into the
 * document. A username is provider data, and a document assembled around it is
 * a document that data can rewrite.
 *
 * The alias is positional — `p0`, `p1` — rather than derived from the username,
 * because a GraphQL alias must be a valid name and a username need not be: a
 * derived alias would be a syntax error for exactly the accounts nobody tests
 * with. `TimelogConnection` carries no field naming who it is about, so the
 * caller keys the answer back by the positions it sent.
 */
export function groupMonthProbe(usernames: readonly string[]): string {
  const declarations = usernames
    .map((_name, index) => `$${probeVariable(index)}: String!`)
    .join(', ')
  const aliases = usernames.map((_name, index) => aliasFor(index)).join('\n      ')
  const extra = declarations === '' ? '' : `, ${declarations}`

  return `
  query GroupMonthProbe($fullPath: ID!, $from: Time!, $to: Time!${extra}) {
    group(fullPath: $fullPath) {
      fullPath
      name
      maxAccessLevel {
        integerValue
        stringValue
      }
      window: timelogs(startTime: $from, endTime: $to, first: 1) {
        count
        totalSpentTime
      }
      ${aliases}
    }
  }
`
}

/** The alias one person's totals come back under, at the given position. */
export function probeAlias(index: number): string {
  return `p${String(index)}`
}

/** The variable one person's username is sent as, at the given position. */
export function probeVariable(index: number): string {
  return `u${String(index)}`
}

function aliasFor(index: number): string {
  return `${probeAlias(index)}: timelogs(startTime: $from, endTime: $to, username: $${probeVariable(index)}, first: 1) {
        count
        totalSpentTime
      }`
}

function columnAliasFor(index: number): string {
  return `${columnAlias(index)}: timelogs(startTime: $${columnFrom(index)}, endTime: $${columnTo(index)}, username: $user, first: 1) {
        count
        totalSpentTime
      }`
}
