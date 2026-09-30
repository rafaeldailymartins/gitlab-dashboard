/**
 * Who could be on a team, and which groups the reader may narrow a report to.
 *
 * Only `GROUP_REF` is on the report's path, resolving a narrowed address before
 * the month is asked. Otherwise a month of hours asks the three documents in
 * `documents.ts` and nothing else; the rest are read when somebody is building a
 * team or choosing a filter.
 */

/**
 * Whoever logged time in a group, as candidates for a team.
 *
 * Whoever logged, not whoever is a member. A group's membership is an
 * access-control list, and on one real squad it offered seventeen names of which
 * eleven had no hours at all, while two people who had logged were not on it.
 * Reading this costs a paged request where a membership list cost one cheap
 * page, and that is the honest price of suggesting the right people.
 *
 * Only `user` is selected. A field not asked for is a field that cannot null the
 * node, and this document wants a set of people rather than a set of entries —
 * so no id, no instant, no duration.
 *
 * `state` and `bot` are read here and nowhere else, because this is the one
 * place they decide anything.
 */
export const GROUP_SUGGESTIONS = `
  query GroupSuggestions($fullPath: ID!, $from: Time!, $to: Time!, $first: Int!, $after: String) {
    group(fullPath: $fullPath) {
      timelogs(startTime: $from, endTime: $to, sort: SPENT_AT_DESC, first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
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
 * The groups the reader may open.
 *
 * `allAvailable: false` restricts the answer to groups they are authorized in,
 * which is broader than their direct memberships: it finds a subgroup for
 * somebody who joined at an ancestor, and that is the archetypal team lead.
 *
 * `id` is selected because the report's filter argument is `groupId: GroupID`
 * and takes the provider's own identifier. The picker hands back what this
 * returns, so leaving the id out here would be a silently wrong scope rather
 * than an error.
 */
export const MY_GROUPS = `
  query MyGroups($search: String, $first: Int!) {
    groups(search: $search, allAvailable: false, first: $first) {
      nodes {
        id
        fullPath
        name
      }
    }
  }
`

/** People the provider can find, for putting one on a team by name. */
export const PEOPLE_SEARCH = `
  query PeopleSearch($search: String!, $first: Int!) {
    users(search: $search, first: $first) {
      nodes {
        id
        name
        username
        webUrl
      }
    }
  }
`

/**
 * One group, by the path an address names.
 *
 * The filter travels in the address as a path, because a path is legible and an
 * address is meant to be sent to somebody. The provider's filter argument takes
 * its own identifier, so the two are reconciled here — once, cheaply, and
 * cached. `group: null` is also the answer to "this reader cannot open the group
 * your link names", which the screen says rather than silently reporting the
 * reader's whole reach under a scoped caption.
 */
export const GROUP_REF = `
  query GroupRef($fullPath: ID!) {
    group(fullPath: $fullPath) {
      id
      fullPath
      name
    }
  }
`
