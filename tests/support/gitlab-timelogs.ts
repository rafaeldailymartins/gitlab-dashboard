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

/**
 * The message GitLab reports for an entry whose project it will not resolve.
 *
 * `Timelog.project` is non-nullable in GitLab's schema and the connection's
 * items are not, so null propagation replaces the whole entry with `null`. The
 * text is GitLab's own, recorded from production on 2026-08-31.
 */
export const WITHHELD_PROJECT_MESSAGE = 'Cannot return null for non-nullable field Timelog.project'

/**
 * Where GitLab withheld an entry in the recorded answer.
 *
 * The real positions, kept because they are what a run against production
 * produced: three withheld entries scattered through the page rather than
 * conveniently at its end.
 */
export const WITHHELD_POSITIONS = [7, 8, 10]

/** How many entries the recorded page carried, the withheld ones included. */
const RECORDED_PAGE_SIZE = 11

/**
 * The entries behind the recorded answer, one per day, newest first.
 *
 * Distinct instants and durations, because reconciling two answers compares
 * entries by what is readable about them; a page of identical fixtures would
 * agree with any merge, correct or not.
 */
export function recordedTimelogNodes() {
  return Array.from({ length: RECORDED_PAGE_SIZE }, (_unused, index) =>
    timelogNode({
      spentAt: `2026-08-${String(20 - index)}T15:00:00Z`,
      timeSpent: 24_120 - index * 600,
    }),
  )
}

/** The recovery answer as a client hands it on. */
export function recoveredTimelogsAnswer() {
  return { data: recoveredTimelogsPayload().data, errors: [] }
}

/**
 * The same page asked again without `project`, which is what GitLab could not
 * resolve. Nothing is withheld, and no entry carries a project.
 */
export function recoveredTimelogsPayload() {
  const nodes = recordedTimelogNodes().map(({ project: _project, ...rest }) => rest)

  return { data: timelogsPayload({ nodes }) }
}

/** The same answer as a client hands it on: data, with the messages beside it. */
export function withheldTimelogsAnswer() {
  return {
    data: withheldTimelogsPayload().data,
    errors: WITHHELD_POSITIONS.map(() => WITHHELD_PROJECT_MESSAGE),
  }
}

/**
 * The answer recorded from production: entries, and errors beside them.
 *
 * This is the shape that emptied a reader's dashboard. Every other fixture here
 * was shaped from a response that succeeded, which is exactly why nothing in the
 * suite failed while the app did.
 */
export function withheldTimelogsPayload() {
  const nodes = recordedTimelogNodes().map((node, index) =>
    WITHHELD_POSITIONS.includes(index) ? null : node,
  )

  return {
    data: timelogsPayload({ nodes }),
    errors: WITHHELD_POSITIONS.map((position) => ({
      locations: [{ column: 11, line: 13 }],
      message: WITHHELD_PROJECT_MESSAGE,
      path: ['currentUser', 'timelogs', 'nodes', position, 'project'],
    })),
  }
}
