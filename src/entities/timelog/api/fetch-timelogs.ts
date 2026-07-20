import { GitLabApiError, gitlabGraphql } from '@/shared/api/gitlab'
import type { AppConfig } from '@/shared/config/env'

import type { TimelogEntry } from '../model/types'

const PAGE_SIZE = 100
const MAX_PAGES = 20

const SCOPE_ID_QUERY = {
  group: 'query ($fullPath: ID!) { scope: group(fullPath: $fullPath) { id } }',
  project: 'query ($fullPath: ID!) { scope: project(fullPath: $fullPath) { id } }',
} as const

const TIMELOGS_QUERY = `
  query Timelogs($startDate: Time, $endDate: Time, $groupId: GroupID, $projectId: ProjectID, $first: Int, $after: String) {
    timelogs(startDate: $startDate, endDate: $endDate, groupId: $groupId, projectId: $projectId, first: $first, after: $after) {
      pageInfo {
        endCursor
        hasNextPage
      }
      nodes {
        spentAt
        timeSpent
        summary
        user {
          name
          username
        }
        issue {
          title
          webUrl
          reference(full: true)
        }
        mergeRequest {
          title
          webUrl
          reference(full: true)
        }
      }
    }
  }
`

type TimelogNode = {
  issue: { reference: string; title: string; webUrl: string } | null
  mergeRequest: { reference: string; title: string; webUrl: string } | null
  spentAt: string
  summary: string | null
  timeSpent: number
  user: { name: string; username: string } | null
}

type TimelogsPage = {
  timelogs: {
    nodes: TimelogNode[]
    pageInfo: { endCursor: string | null; hasNextPage: boolean }
  }
}

export type FetchTimelogsResult = {
  entries: TimelogEntry[]
  truncated: boolean
}

/** Busca todos os timelogs do escopo no intervalo, paginando por cursor. */
export async function fetchTimelogs(
  config: AppConfig,
  range: { end: string; start: string },
): Promise<FetchTimelogsResult> {
  const scopeId = await resolveScopeId(config)
  const nodes: TimelogNode[] = []
  let after: string | null = null
  let hasNextPage = true
  let pages = 0

  while (hasNextPage && pages < MAX_PAGES) {
    const data: TimelogsPage = await gitlabGraphql<TimelogsPage>({
      baseUrl: config.baseUrl,
      query: TIMELOGS_QUERY,
      token: config.token,
      variables: {
        after,
        endDate: range.end,
        first: PAGE_SIZE,
        startDate: range.start,
        ...scopeId,
      },
    })

    nodes.push(...data.timelogs.nodes)
    after = data.timelogs.pageInfo.endCursor
    hasNextPage = data.timelogs.pageInfo.hasNextPage
    pages += 1
  }

  return {
    entries: nodes.filter((node) => node.user).map(toEntry),
    truncated: hasNextPage,
  }
}

async function resolveScopeId(config: AppConfig): Promise<{ groupId?: string; projectId?: string }> {
  const data = await gitlabGraphql<{ scope: { id: string } | null }>({
    baseUrl: config.baseUrl,
    query: SCOPE_ID_QUERY[config.scope.type],
    token: config.token,
    variables: { fullPath: config.scope.fullPath },
  })

  if (!data.scope) {
    throw new GitLabApiError(
      `${config.scope.type === 'group' ? 'Grupo' : 'Projeto'} "${config.scope.fullPath}" nao encontrado ou sem acesso com o token atual.`,
    )
  }

  return config.scope.type === 'group' ? { groupId: data.scope.id } : { projectId: data.scope.id }
}

function toEntry(node: TimelogNode): TimelogEntry {
  const item = node.issue ?? node.mergeRequest

  return {
    item: item
      ? {
          key: item.reference,
          title: item.title,
          type: node.issue ? 'issue' : 'mr',
          url: item.webUrl,
        }
      : null,
    seconds: node.timeSpent,
    spentAt: node.spentAt,
    summary: node.summary,
    user: node.user!,
  }
}
