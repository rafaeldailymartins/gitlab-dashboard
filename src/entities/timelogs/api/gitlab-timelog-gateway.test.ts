import { describe, expect, it, vi } from 'vitest'
import {
  mergeRequestNode,
  recordedTimelogNodes,
  recoveredTimelogsAnswer,
  timelogNode,
  timelogsPayload,
  WITHHELD_POSITIONS,
  withheldTimelogsAnswer,
} from '~tests/support/gitlab-timelogs'

import type { GraphQLAnswer, GraphQLClient } from '@/shared/api'

import { gitLabTimelogGateway } from './gitlab-timelog-gateway'

const NEWEST_FIRST = { after: null }

type RequestMock = ReturnType<typeof clientReturning>['request']

/** A client that answers each request in turn, as GitLab does over the two. */
function clientAnswering(answers: readonly GraphQLAnswer[]) {
  let asked = 0
  const request = vi.fn<GraphQLClient['request']>(() => {
    const answer = answers.at(Math.min(asked, answers.length - 1))
    asked += 1

    return Promise.resolve(answer ?? { data: null, errors: [] })
  })

  return { client: { request } satisfies GraphQLClient, request }
}

function clientReturning(data: unknown) {
  return clientAnswering([{ data, errors: [] }])
}

function sentBy(request: RequestMock) {
  return request.mock.calls.at(0)?.at(0)
}

/** The two answers GitLab gives for a page it withheld entries from. */
function withheldClient() {
  return clientAnswering([withheldTimelogsAnswer(), recoveredTimelogsAnswer()])
}

describe('gitLabTimelogGateway', () => {
  it('asks for the reader own entries, newest first', async () => {
    const { client, request } = clientReturning(timelogsPayload())

    await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(sentBy(request)?.query).toContain('currentUser')
    expect(sentBy(request)?.query).toContain('SPENT_AT_DESC')
  })

  it('names no group and no project, so every project counts', async () => {
    const { client, request } = clientReturning(timelogsPayload())

    await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(sentBy(request)?.query).not.toContain('groupId')
    expect(sentBy(request)?.query).not.toContain('projectId')
  })

  it('asks GitLab for no period, because it would filter one in UTC', async () => {
    const { client, request } = clientReturning(timelogsPayload())

    await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(sentBy(request)?.query).not.toContain('startDate')
    expect(sentBy(request)?.query).not.toContain('endDate')
  })

  it('asks for a hundred entries at a time', async () => {
    const { client, request } = clientReturning(timelogsPayload())

    await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(sentBy(request)?.variables).toEqual({ after: null, first: 100 })
  })

  it('forwards a cursor when continuing into older history', async () => {
    const { client, request } = clientReturning(timelogsPayload())

    await gitLabTimelogGateway(client).myTimelogs({ after: 'cursor-1' })

    expect(sentBy(request)?.variables).toMatchObject({ after: 'cursor-1' })
  })

  it('forwards a cancellation signal', async () => {
    const { client, request } = clientReturning(timelogsPayload())
    const controller = new AbortController()

    await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST, controller.signal)

    expect(sentBy(request)?.signal).toBe(controller.signal)
  })

  it('omits the signal when there is nothing to cancel with', async () => {
    const { client, request } = clientReturning(timelogsPayload())

    await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(sentBy(request)).not.toHaveProperty('signal')
  })

  it('normalises an entry into what the model expects', async () => {
    const { client } = clientReturning(timelogsPayload())

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries[0]).toEqual({
      project: {
        fullPath: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
        name: 'invent.fiscal.inventariofiscal',
        webUrl: 'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal',
      },
      seconds: 24_120,
      spentAt: new Date('2026-08-20T15:00:00Z'),
      summary: null,
      workItem: {
        kind: 'issue',
        reference: 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal#128',
        title: '[CIAP] Frontend: tela de importações com assistente e histórico',
        webUrl:
          'https://gitlab.com/invent-software/invent-apps-2/squad-fiscal/inventariofiscal/-/work_items/128',
      },
    })
  })

  it('reads an empty summary as no summary, which is what GitLab sends', async () => {
    const { client } = clientReturning(timelogsPayload({ nodes: [timelogNode({ summary: '' })] }))

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries[0]?.summary).toBeNull()
  })

  it('keeps a summary the reader typed', async () => {
    const { client } = clientReturning(
      timelogsPayload({ nodes: [timelogNode({ summary: 'Pairing on the rounding' })] }),
    )

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries[0]?.summary).toBe('Pairing on the rounding')
  })

  it('recognises time logged on a merge request', async () => {
    const reference = 'invent-software/invent-apps-2/squad-fiscal/inventariofiscal!34'
    const { client } = clientReturning(
      timelogsPayload({
        nodes: [timelogNode({ issue: null, mergeRequest: mergeRequestNode(reference) })],
      }),
    )

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries[0]?.workItem).toMatchObject({ kind: 'merge-request', reference })
  })

  it('keeps time logged with neither an issue nor a merge request', async () => {
    const { client } = clientReturning(
      timelogsPayload({ nodes: [timelogNode({ issue: null, mergeRequest: null })] }),
    )

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries[0]?.workItem).toBeNull()
    expect(page.entries[0]?.seconds).toBe(24_120)
  })

  it('reports a cursor only while older entries remain', async () => {
    const more = clientReturning(timelogsPayload({ endCursor: 'older', hasNextPage: true }))
    const done = clientReturning(timelogsPayload({ endCursor: 'older', hasNextPage: false }))

    await expect(gitLabTimelogGateway(more.client).myTimelogs(NEWEST_FIRST)).resolves.toMatchObject(
      {
        nextCursor: 'older',
      },
    )
    await expect(gitLabTimelogGateway(done.client).myTimelogs(NEWEST_FIRST)).resolves.toMatchObject(
      {
        nextCursor: null,
      },
    )
  })

  it('reports an empty history as empty rather than as a failure', async () => {
    const { client } = clientReturning(timelogsPayload({ endCursor: null, nodes: [] }))

    await expect(gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)).resolves.toEqual({
      entries: [],
      nextCursor: null,
    })
  })

  it('reports no person behind the token as an empty report', async () => {
    const { client } = clientReturning({ currentUser: null })

    await expect(gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)).resolves.toEqual({
      entries: [],
      nextCursor: null,
    })
  })

  it('rejects a payload that does not match the schema, naming the field', async () => {
    const { client } = clientReturning(
      timelogsPayload({ nodes: [timelogNode({ timeSpent: '6h42m' as unknown as number })] }),
    )

    await expect(gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)).rejects.toThrow(/timeSpent/)
  })

  it('rejects a payload missing the connection entirely', async () => {
    const { client } = clientReturning({ currentUser: { timelogs: null } })

    await expect(gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)).rejects.toThrow()
  })
})

/**
 * The shape recorded from production: `200`, entries in `data`, and errors
 * beside them for the three GitLab would not resolve a project for. Every
 * fixture in this suite used to be shaped from an answer that succeeded, which is
 * why a green suite sat over an empty dashboard.
 */
describe('a page GitLab withheld entries from', () => {
  it('reports the entries it could read rather than failing', async () => {
    const { client } = withheldClient()

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries.length).toBeGreaterThan(0)
  })

  it('counts every entry of the page, including the withheld ones', async () => {
    const { client } = withheldClient()

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries).toHaveLength(recordedTimelogNodes().length)
  })

  it('recovers the withheld hours exactly', async () => {
    const { client } = withheldClient()
    const logged = recordedTimelogNodes().reduce((total, node) => total + node.timeSpent, 0)

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries.reduce((total, entry) => total + entry.seconds, 0)).toBe(logged)
  })

  it('leaves the recovered entries with no project', async () => {
    const { client } = withheldClient()

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries.filter((entry) => entry.project === null)).toHaveLength(
      WITHHELD_POSITIONS.length,
    )
  })

  it('says how many were withheld and how many came back', async () => {
    const { client } = withheldClient()

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.withheld).toBe(WITHHELD_POSITIONS.length)
    expect(page.recovered).toBe(WITHHELD_POSITIONS.length)
  })

  it('keeps the merged entries newest first', async () => {
    const { client } = withheldClient()

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)
    const instants = page.entries.map((entry) => entry.spentAt.getTime())

    expect(instants).toEqual(instants.toSorted((left, right) => right - left))
  })

  it('asks for the same page again, without the project', async () => {
    const { client, request } = withheldClient()

    await gitLabTimelogGateway(client).myTimelogs({ after: 'cursor-1' })
    const second = request.mock.calls.at(1)?.at(0)

    expect(second?.variables).toEqual({ after: 'cursor-1', first: 100 })
    expect(second?.query).toContain('timelogs')
    expect(second?.query).not.toContain('project')
  })

  it('asks exactly twice, not once per withheld entry', async () => {
    const { client, request } = withheldClient()

    await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('forwards the cancellation signal to the second request too', async () => {
    const { client, request } = withheldClient()
    const controller = new AbortController()

    await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST, controller.signal)

    expect(request.mock.calls.at(1)?.at(0)?.signal).toBe(controller.signal)
  })
})

describe('a page GitLab answered whole', () => {
  it('is not asked for a second time', async () => {
    const { client, request } = clientReturning(timelogsPayload())

    await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('reports no counts at all, because there is nothing to report', async () => {
    const { client } = clientReturning(timelogsPayload())

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.withheld).toBeUndefined()
    expect(page.recovered).toBeUndefined()
  })
})

/**
 * The worst case, and the one a fixture would never think to cover: GitLab
 * resolves nothing in the page. Inventing an entry here would be worse than
 * reporting none, because a figure that is too high makes every other figure
 * untrustworthy.
 */
describe('a page GitLab withheld entirely', () => {
  const nodes = [null, null]

  it('reports what came back from the second request', async () => {
    const { client } = clientAnswering([
      { data: timelogsPayload({ nodes }), errors: ['withheld', 'withheld'] },
      recoveredTimelogsAnswer(),
    ])

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries).toHaveLength(2)
    expect(page.withheld).toBe(2)
    expect(page.recovered).toBe(2)
  })

  it('neither throws nor invents an entry when the second request fails too', async () => {
    const { client } = clientAnswering([
      { data: timelogsPayload({ nodes }), errors: ['withheld', 'withheld'] },
      { data: timelogsPayload({ nodes }), errors: ['unreadable', 'unreadable'] },
    ])

    const page = await gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)

    expect(page.entries).toEqual([])
    expect(page.withheld).toBe(2)
    expect(page.recovered).toBe(0)
  })
})

/**
 * The error that would be worst to swallow. An error can null `currentUser`
 * itself, and `data.currentUser: null` with no errors already means "GitLab
 * accepted the token and resolved nobody". Reading the two the same way would
 * tell a reader they logged no hours, as a fact, because of an error nobody
 * passed on.
 */
describe('an answer whose errors took the whole person with them', () => {
  it('is reported as refused rather than as an empty history', async () => {
    const { client } = clientAnswering([
      { data: { currentUser: null }, errors: ['Something went wrong'] },
    ])

    await expect(gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)).rejects.toMatchObject({
      failure: { kind: 'rejected', messages: ['Something went wrong'] },
    })
  })

  it('still reads a null person with no errors as an empty report', async () => {
    const { client } = clientReturning({ currentUser: null })

    await expect(gitLabTimelogGateway(client).myTimelogs(NEWEST_FIRST)).resolves.toEqual({
      entries: [],
      nextCursor: null,
    })
  })
})
