export interface TimelogNodeOverrides {
  issue?: null | WorkItemNode
  mergeRequest?: null | WorkItemNode
  project?: ProjectNode
  spentAt?: string
  summary?: null | string
  timeSpent?: number
}

/**
 * Fixtures shaped from a real `currentUser.timelogs` response, recorded from
 * gitlab.com while designing the query.
 *
 * The field names, the deep project path, the `/-/work_items/` link form, the
 * empty-string summary and the instant format are all exactly what GitLab
 * sends. A fixture that agreed with our own schema but not with GitLab's would
 * pass while the app failed.
 */
interface ProjectNode {
  fullPath: string
  name: string
  webUrl: string
}

interface WorkItemNode {
  reference: string
  title: string
  webUrl: string
}

export const FISCAL_PROJECT: ProjectNode = {
  fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
  name: 'invent.fiscal.inventariofiscal',
  webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
}

/** The most recent entry observed for this account: 6h42m on 2026-08-20. */
export const RECORDED_TIMELOG = {
  issue: {
    reference: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal#128',
    title: '[CIAP] Frontend: tela de importações com assistente e histórico',
    webUrl:
      'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal/-/work_items/128',
  },
  mergeRequest: null,
  project: FISCAL_PROJECT,
  spentAt: '2026-08-20T15:00:00Z',
  summary: '',
  timeSpent: 24_120,
}

interface PayloadOverrides {
  endCursor?: null | string
  hasNextPage?: boolean
  nodes?: unknown[]
}

export function mergeRequestNode(reference: string): WorkItemNode {
  const [path = '', iid = ''] = reference.split('!')

  return {
    reference,
    title: 'Resolve the rounding of the credit calculation',
    webUrl: `https://gitlab.com/${path}/-/merge_requests/${iid}`,
  }
}

export function timelogNode(overrides: TimelogNodeOverrides = {}) {
  return { ...RECORDED_TIMELOG, ...overrides }
}

/** A whole payload, defaulting to one page that ends the history. */
export function timelogsPayload(overrides: PayloadOverrides = {}) {
  return {
    currentUser: {
      timelogs: {
        nodes: overrides.nodes ?? [timelogNode()],
        pageInfo: {
          endCursor: overrides.endCursor ?? 'eyJzcGVudF9hdCI6IjIwMjYtMDgtMTkifQ',
          hasNextPage: overrides.hasNextPage ?? false,
        },
      },
    },
  }
}
