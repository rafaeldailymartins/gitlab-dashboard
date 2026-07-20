import { gitlabGraphql } from '@/shared/api/gitlab'
import type { AppConfig } from '@/shared/config/env'

import type { TimelogUser } from '../model/types'

const PAGE_SIZE = 100
const MAX_PAGES = 10

const MEMBERS_QUERY = {
  group: `
    query GroupMembers($fullPath: ID!, $first: Int, $after: String) {
      scope: group(fullPath: $fullPath) {
        members: groupMembers(relations: [DIRECT, INHERITED, DESCENDANTS], first: $first, after: $after) {
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            user {
              bot
              name
              username
            }
          }
        }
      }
    }
  `,
  project: `
    query ProjectMembers($fullPath: ID!, $first: Int, $after: String) {
      scope: project(fullPath: $fullPath) {
        members: projectMembers(relations: [DIRECT, INHERITED], first: $first, after: $after) {
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            user {
              bot
              name
              username
            }
          }
        }
      }
    }
  `,
} as const

type MembersPage = {
  scope: {
    members: {
      nodes: { user: { bot: boolean; name: string; username: string } | null }[]
      pageInfo: { endCursor: string | null; hasNextPage: boolean }
    } | null
  } | null
}

/**
 * Lista os membros do grupo/projeto (sem bots). Retorna null quando o GitLab nega
 * a listagem (token sem membresia direta no escopo) — o chamador usa fallback.
 */
export async function fetchMembers(config: AppConfig): Promise<TimelogUser[] | null> {
  const members = new Map<string, TimelogUser>()
  let after: string | null = null
  let hasNextPage = true
  let pages = 0

  try {
    while (hasNextPage && pages < MAX_PAGES) {
      const data: MembersPage = await gitlabGraphql<MembersPage>({
        baseUrl: config.baseUrl,
        query: MEMBERS_QUERY[config.scope.type],
        token: config.token,
        variables: { after, first: PAGE_SIZE, fullPath: config.scope.fullPath },
      })

      const page = data.scope?.members
      if (!page) return null

      for (const node of page.nodes) {
        if (node.user && !node.user.bot) {
          members.set(node.user.username, { name: node.user.name, username: node.user.username })
        }
      }

      after = page.pageInfo.endCursor
      hasNextPage = page.pageInfo.hasNextPage
      pages += 1
    }
  } catch {
    return null
  }

  return [...members.values()]
}
