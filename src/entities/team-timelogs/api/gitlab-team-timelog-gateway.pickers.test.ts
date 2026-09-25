import { describe, expect, it, vi } from 'vitest'
import {
  ANA,
  BRUNO,
  groupsPayload,
  peoplePayload,
  SQUAD_FISCAL,
} from '~tests/support/gitlab-team-timelogs'

import type { GraphQLAnswer, GraphQLClient } from '@/shared/api'

import { gitLabTeamTimelogGateway } from './gitlab-team-timelog-gateway'

/**
 * The three reads that are not on the report's path: the group an address
 * names, and the two pickers behind the filter and the team editor. They are
 * split from the rounds because nothing they assert is about a window of hours.
 */
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

describe('the group an address names', () => {
  it('reconciles the path in the address with the identifier the filter takes', async () => {
    const { client, sent } = fakeClient([{ data: { group: SQUAD_FISCAL } }])

    const group = await gitLabTeamTimelogGateway(client).group(SQUAD_FISCAL.fullPath)

    expect(sent[0]?.variables).toMatchObject({ fullPath: SQUAD_FISCAL.fullPath })
    expect(group).toEqual(SQUAD_FISCAL)
  })

  it('reports null for a group this reader cannot open', async () => {
    // A fact the screen states rather than an error: a link naming a group the
    // recipient has no access to must not silently widen into their whole reach
    // under a caption that says otherwise.
    const { client } = fakeClient([{ data: { group: null } }])

    expect(await gitLabTeamTimelogGateway(client).group(SQUAD_FISCAL.fullPath)).toBeNull()
  })

  it('falls back to the path when the provider withholds the name', async () => {
    const { client } = fakeClient([{ data: { group: { ...SQUAD_FISCAL, name: null } } }])

    const group = await gitLabTeamTimelogGateway(client).group(SQUAD_FISCAL.fullPath)

    expect(group?.name).toBe(SQUAD_FISCAL.fullPath)
  })
})

describe('the group picker', () => {
  it('offers the groups the reader is authorized in, not only their memberships', async () => {
    // `allAvailable: false` still finds a subgroup somebody joined at an
    // ancestor, which is the archetypal team lead.
    const { client, sent } = fakeClient([{ data: groupsPayload() }])

    const groups = await gitLabTeamTimelogGateway(client).groups('fiscal')

    expect(sent[0]?.query).toContain('allAvailable: false')
    expect(sent[0]?.variables).toMatchObject({ search: 'fiscal' })
    expect(groups).toEqual([SQUAD_FISCAL])
  })

  it('drops a group the provider would not describe', async () => {
    const { client } = fakeClient([
      { data: { groups: { nodes: [null, ...groupsPayload().groups.nodes] } } },
    ])

    expect(await gitLabTeamTimelogGateway(client).groups(null)).toEqual([SQUAD_FISCAL])
  })

  it('offers nothing when the provider resolved no groups at all', async () => {
    const { client } = fakeClient([{ data: { groups: null } }])

    expect(await gitLabTeamTimelogGateway(client).groups(null)).toEqual([])
  })
})

describe('the people picker', () => {
  it('finds whoever the provider can match to what was typed', async () => {
    const { client, sent } = fakeClient([{ data: peoplePayload([ANA, BRUNO]) }])

    const people = await gitLabTeamTimelogGateway(client).people('a')

    expect(sent[0]?.variables).toMatchObject({ search: 'a' })
    expect(people).toEqual([ANA, BRUNO])
  })

  it('drops a person the provider would not describe', async () => {
    const { client } = fakeClient([
      { data: { users: { nodes: [...peoplePayload([ANA]).users.nodes, null] } } },
    ])

    expect(await gitLabTeamTimelogGateway(client).people('ana')).toEqual([ANA])
  })

  it('finds nobody when the provider resolved no users at all', async () => {
    const { client } = fakeClient([{ data: { users: null } }])

    expect(await gitLabTeamTimelogGateway(client).people('ana')).toEqual([])
  })
})

describe('the caller’s abort signal', () => {
  it('is forwarded when the caller gave one', async () => {
    const controller = new AbortController()
    const { client } = fakeClient([{ data: groupsPayload() }])

    await gitLabTeamTimelogGateway(client).groups(null, controller.signal)

    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('is left out altogether when the caller gave none', async () => {
    // Left out rather than sent as undefined: `exactOptionalPropertyTypes` makes
    // the two different requests, and a present-but-undefined signal is a shape
    // the client never has to reason about.
    const { client } = fakeClient([{ data: groupsPayload() }])

    await gitLabTeamTimelogGateway(client).groups(null)

    expect(client.request).toHaveBeenCalledWith(expect.not.objectContaining({ signal: undefined }))
  })
})
