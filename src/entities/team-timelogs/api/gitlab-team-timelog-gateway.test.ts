import { describe, expect, it, vi } from 'vitest'
import {
  ANA,
  BRUNO,
  columnProbePayload,
  followingPayload,
  member,
  SQUAD_FISCAL,
  suggestionsPayload,
  teamHoursPayload,
  timelogNode,
} from '~tests/support/gitlab-team-timelogs'

import { type GraphQLAnswer, type GraphQLClient, GraphQLRequestError } from '@/shared/api'

import type { TeamFollowingQuery, TeamHoursQuery } from '../model/ports'

import { gitLabTeamTimelogGateway } from './gitlab-team-timelog-gateway'

const WINDOW = { from: '2026-04-30T00:00:00.000Z', to: '2026-06-01T23:59:59.999999Z' }
const QUERY: TeamHoursQuery = { ...WINDOW, groupId: null, members: [member(ANA), member(BRUNO)] }
const FOLLOWING: TeamFollowingQuery = {
  ...WINDOW,
  cursors: [{ cursor: 'MQ', memberId: ANA.id }],
  groupId: null,
}

/**
 * The aggregates and the nodes under one and the same `timelogs(...)` field.
 *
 * Read as two fields they would be two relations read at two instants, and the
 * shortfall between them would move for reasons that are not redaction.
 *
 * `(?!timelogs\()` is the load-bearing part: without it the pattern matches a
 * document that asks the aggregates under one alias and the nodes under a
 * second connection beside it, which is the arrangement it exists to forbid.
 */
const ONE_CONNECTION =
  /timelogs\([^)]*\)\s*\{\s*count\s+totalSpentTime(?:(?!timelogs\()[\s\S])*?nodes \{/

interface Sent {
  query: string
  variables: Record<string, unknown>
}

/** Answers each request in turn, recording what was asked. */
function fakeClient(answers: readonly Partial<GraphQLAnswer>[]) {
  const sent: Sent[] = []
  let call = 0

  // The parameter is named through the port rather than inferred from `vi.fn`,
  // which would hand it `any` and take the type off everything it touches.
  const request = vi.fn((asked: Parameters<GraphQLClient['request']>[0]) => {
    sent.push({ query: asked.query, variables: asked.variables })

    const answer = answers[Math.min(call, answers.length - 1)]

    call += 1

    return Promise.resolve({ data: answer?.data, errors: answer?.errors ?? [] })
  })

  return { client: { request } satisfies GraphQLClient, sent }
}

describe('the round document', () => {
  it('asks for an instant window and never for a calendar date', async () => {
    // `startDate`/`endDate` are truncated to UTC calendar days, so a month asked
    // that way is a different month for every reader outside UTC.
    const { client, sent } = fakeClient([{ data: teamHoursPayload() }])

    await gitLabTeamTimelogGateway(client).timelogs(QUERY)

    expect(sent[0]?.query).toContain('startTime: $from')
    expect(sent[0]?.query).toContain('endTime: $to')
    expect(sent[0]?.query).not.toContain('startDate')
    expect(sent[0]?.query).not.toContain('endDate')
  })

  it('addresses people by id, sent as a variable rather than written into the document', async () => {
    // A document assembled around provider data is a document that data can
    // rewrite, and a username can be released on rename and claimed again.
    const { client, sent } = fakeClient([{ data: teamHoursPayload() }])

    await gitLabTeamTimelogGateway(client).timelogs(QUERY)

    expect(sent[0]?.query).toContain('users(ids: $ids')
    expect(sent[0]?.variables).toMatchObject({ ids: [ANA.id, BRUNO.id], people: 2 })
    expect(sent[0]?.query).not.toContain(ANA.id)
  })

  it('asks the aggregates on the same connection as the nodes', async () => {
    const { client, sent } = fakeClient([{ data: teamHoursPayload() }])

    await gitLabTeamTimelogGateway(client).timelogs(QUERY)

    expect(sent[0]?.query).toMatch(ONE_CONNECTION)
  })

  it('never asks which project a timelog belongs to', async () => {
    // `Timelog.project` is non-nullable while the connection's items are not,
    // so a project this reader cannot resolve nulls the whole entry and takes
    // its hours with it.
    const { client, sent } = fakeClient([{ data: teamHoursPayload() }])

    await gitLabTeamTimelogGateway(client).timelogs(QUERY)

    expect(sent[0]?.query).not.toContain('project')
  })

  it('narrows the round to the group the filter names', async () => {
    const { client, sent } = fakeClient([{ data: teamHoursPayload() }])

    await gitLabTeamTimelogGateway(client).timelogs({ ...QUERY, groupId: SQUAD_FISCAL.id })

    expect(sent[0]?.query).toContain('groupId: $group')
    expect(sent[0]?.variables['group']).toBe(SQUAD_FISCAL.id)
  })

  it('asks the reader’s whole reach when nothing narrows it', async () => {
    const { client, sent } = fakeClient([{ data: teamHoursPayload() }])

    await gitLabTeamTimelogGateway(client).timelogs(QUERY)

    expect(sent[0]?.variables['group']).toBeNull()
  })
})

describe('reading a round', () => {
  it('reports each person, their entries and what the window declared', async () => {
    const { client } = fakeClient([{ data: teamHoursPayload() }])

    const page = await gitLabTeamTimelogGateway(client).timelogs(QUERY)

    expect(page.members[0]?.person).toEqual(ANA)
    expect(page.members[0]?.declared).toEqual({ entryCount: 1, seconds: 24_120 })
    expect(page.members[0]?.entries[0]?.spentAt.toISOString()).toBe('2026-05-12T15:00:00.000Z')
    expect(page.members[0]?.nextCursor).toBeNull()
  })

  it('keeps reading past a round whose entries were all removed', async () => {
    // `hasNextPage` is computed before the provider removes what the reader may
    // not read, so a round can carry no nodes and still have more after it.
    const { client } = fakeClient([
      {
        data: teamHoursPayload({
          people: [{ cursor: 'MQ', more: true, nodes: [], person: ANA }],
        }),
      },
    ])

    const page = await gitLabTeamTimelogGateway(client).timelogs(QUERY)

    expect(page.members[0]?.entries).toEqual([])
    expect(page.members[0]?.nextCursor).toBe('MQ')
  })

  it('drops an entry with no instant while the declaration still counts it', async () => {
    // Which day it belongs to is unknowable, so placing it anywhere would be an
    // invention. The difference against the declaration is what reports it.
    const { client } = fakeClient([
      {
        data: teamHoursPayload({
          people: [
            {
              declared: { entryCount: 2, seconds: 48_240 },
              nodes: [timelogNode(), timelogNode({ spentAt: null })],
              person: ANA,
            },
          ],
        }),
      },
    ])

    const page = await gitLabTeamTimelogGateway(client).timelogs(QUERY)

    expect(page.members[0]?.entries).toHaveLength(1)
    expect(page.members[0]?.declared?.entryCount).toBe(2)
  })

  it('coerces the total the provider serialises a BigInt as', async () => {
    const { client } = fakeClient([
      {
        data: teamHoursPayload({
          people: [{ declared: { entryCount: 3, seconds: 167_400 }, person: ANA }],
        }),
      },
    ])

    const page = await gitLabTeamTimelogGateway(client).timelogs(QUERY)

    expect(page.members[0]?.declared?.seconds).toBe(167_400)
  })

  it('refuses when the provider resolved nobody and complained', async () => {
    const { client } = fakeClient([
      { data: teamHoursPayload({ users: null }), errors: ['not authorized'] },
    ])

    await expect(gitLabTeamTimelogGateway(client).timelogs(QUERY)).rejects.toThrow(
      GraphQLRequestError,
    )
  })

  it('reports an empty round when the provider resolved nobody in silence', async () => {
    const { client } = fakeClient([{ data: teamHoursPayload({ users: null }) }])

    expect(await gitLabTeamTimelogGateway(client).timelogs(QUERY)).toEqual({ members: [] })
  })

  it('refuses rather than omit somebody the provider capped the team at', async () => {
    // `first` is the batch's own length, so more people after it means fewer
    // came back than the team names — and a report quietly missing a colleague
    // is worse than one that failed.
    const { client } = fakeClient([{ data: teamHoursPayload({ hasNextPage: true }) }])

    await expect(gitLabTeamTimelogGateway(client).timelogs(QUERY)).rejects.toThrow(
      GraphQLRequestError,
    )
  })
})

describe('what the gateway hands each reader', () => {
  // `readColumnProbe`, `readFollowing` and `readSuggestions` are exercised on
  // their own beside this file, so what is only true here is the wiring: each
  // method reaches its own document through the client the gateway was built
  // with, carrying the caller's signal. Asserting their behaviour again would
  // pin the same rules in two places and make one of them the stale copy.
  const COLUMNS = { ...WINDOW, columns: [], groupId: null, memberId: ANA.id }
  const SUGGESTIONS = { ...WINDOW, fullPath: SQUAD_FISCAL.fullPath }

  it('sends a probe to the document that measures one person’s days', async () => {
    const { client, sent } = fakeClient([
      { data: columnProbePayload([], { entryCount: 0, seconds: 0 }) },
    ])

    await gitLabTeamTimelogGateway(client).columns(COLUMNS)

    expect(sent[0]?.query).toContain('query TeamColumnProbe')
  })

  it('sends a continuation to the document that addresses one person per alias', async () => {
    const { client, sent } = fakeClient([{ data: followingPayload([{ person: ANA }]) }])

    await gitLabTeamTimelogGateway(client).following(FOLLOWING)

    expect(sent[0]?.query).toContain('query TeamHoursFollowing')
  })

  it('sends a search for candidates to the document that reads a group’s entries', async () => {
    const controller = new AbortController()
    const { client, sent } = fakeClient([{ data: suggestionsPayload() }])

    await gitLabTeamTimelogGateway(client).suggestions(SUGGESTIONS, controller.signal)

    expect(sent[0]?.query).toContain('query GroupSuggestions')
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})
