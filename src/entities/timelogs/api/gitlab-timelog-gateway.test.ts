import { describe, expect, it, vi } from 'vitest'
import { mergeRequestNode, timelogNode, timelogsPayload } from '~tests/support/gitlab-timelogs'

import type { GraphQLClient } from '@/shared/api'

import { gitLabTimelogGateway } from './gitlab-timelog-gateway'

const NEWEST_FIRST = { after: null }

type RequestMock = ReturnType<typeof clientReturning>['request']

function clientReturning(data: unknown) {
  const request = vi.fn<GraphQLClient['request']>(() => Promise.resolve(data))

  return { client: { request } satisfies GraphQLClient, request }
}

function sentBy(request: RequestMock) {
  return request.mock.calls.at(0)?.at(0)
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
