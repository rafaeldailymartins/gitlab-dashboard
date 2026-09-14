import { describe, expect, it, vi } from 'vitest'
import {
  ANA,
  BRUNO,
  groupHoursPayload,
  groupsPayload,
  memberNode,
  probePayload,
  rosterPayload,
  SQUAD_FISCAL,
  timelogNode,
} from '~tests/support/gitlab-group-timelogs'

import { type GraphQLAnswer, type GraphQLClient, GraphQLRequestError } from '@/shared/api'

import { gitLabGroupTimelogGateway } from './gitlab-group-timelog-gateway'

const WINDOW = { from: '2026-04-30T00:00:00.000Z', to: '2026-06-01T23:59:59.999Z' }
const QUERY = { ...WINDOW, after: null, fullPath: SQUAD_FISCAL.fullPath }

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

  const client: GraphQLClient = { request }

  return { client, sent }
}

describe('the page document', () => {
  it('asks for an instant window and never for a calendar date', async () => {
    const { client, sent } = fakeClient([{ data: groupHoursPayload() }])

    await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(sent[0]?.query).toContain('startTime: $from')
    expect(sent[0]?.query).toContain('endTime: $to')
    expect(sent[0]?.query).not.toContain('startDate')
    expect(sent[0]?.query).not.toContain('endDate')
  })

  it('asks the group by path rather than the root timelogs field', async () => {
    const { client, sent } = fakeClient([{ data: groupHoursPayload() }])

    await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(sent[0]?.query).toContain('group(fullPath: $fullPath)')
  })

  it('asks for neither the project nor the window aggregates on a page', async () => {
    const { client, sent } = fakeClient([{ data: groupHoursPayload() }])

    await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(sent[0]?.query).not.toContain('project')
    expect(sent[0]?.query).not.toContain('totalSpentTime')
    expect(sent[0]?.query).not.toContain('count')
  })

  it('states the oldest-first ordering rather than relying on a default', async () => {
    const { client, sent } = fakeClient([{ data: groupHoursPayload() }])

    await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(sent[0]?.query).toContain('sort: SPENT_AT_ASC')
  })

  it('sends the window and the cursor it was given', async () => {
    const { client, sent } = fakeClient([{ data: groupHoursPayload() }])

    await gitLabGroupTimelogGateway(client).timelogs({ ...QUERY, after: 'MQ' })

    expect(sent[0]?.variables).toMatchObject({ after: 'MQ', from: WINDOW.from, to: WINDOW.to })
  })
})

describe('reading a page', () => {
  it('normalises the entries and names the group', async () => {
    const { client } = fakeClient([{ data: groupHoursPayload() }])

    const page = await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(page.group).toEqual(SQUAD_FISCAL)
    expect(page.entries).toHaveLength(1)
    expect(page.entries[0]?.person.username).toBe(ANA.username)
    expect(page.entries[0]?.spentAt.toISOString()).toBe('2026-05-12T15:00:00.000Z')
  })

  it('reports no cursor when the window has been read', async () => {
    const { client } = fakeClient([{ data: groupHoursPayload({ hasNextPage: false }) }])

    const page = await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(page.nextCursor).toBeNull()
  })

  it('keeps paging past a page whose entries were all removed', async () => {
    // GitLab computes the cursor before removing entries the reader may not
    // read, so an empty page with more after it is legitimate.
    const { client } = fakeClient([
      { data: groupHoursPayload({ endCursor: 'MQ', hasNextPage: true, nodes: [] }) },
    ])

    const page = await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(page.entries).toEqual([])
    expect(page.nextCursor).toBe('MQ')
  })

  it('keeps paging past a page shorter than the size it asked for', async () => {
    const { client } = fakeClient([
      { data: groupHoursPayload({ endCursor: 'MQ', hasNextPage: true }) },
    ])

    const page = await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(page.nextCursor).toBe('MQ')
  })

  it('drops a null node without losing the rest of the page', async () => {
    const { client } = fakeClient([
      { data: groupHoursPayload({ nodes: [timelogNode(), null, timelogNode()] }) },
    ])

    const page = await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(page.entries).toHaveLength(2)
  })

  it('drops an entry with no instant, which belongs to no day', async () => {
    const { client } = fakeClient([
      { data: groupHoursPayload({ nodes: [timelogNode({ spentAt: null }), timelogNode()] }) },
    ])

    const page = await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(page.entries).toHaveLength(1)
  })

  it('reports an empty report for a group nobody resolved and nothing complained about', async () => {
    const { client } = fakeClient([{ data: { group: null } }])

    const page = await gitLabGroupTimelogGateway(client).timelogs(QUERY)

    expect(page).toEqual({ entries: [], group: null, nextCursor: null })
  })

  it('refuses when the group is null and errors came with it', async () => {
    const { client } = fakeClient([{ data: { group: null }, errors: ['not authorized'] }])

    await expect(gitLabGroupTimelogGateway(client).timelogs(QUERY)).rejects.toThrow(
      GraphQLRequestError,
    )
  })
})

describe('the probe', () => {
  const query = { ...QUERY, usernames: [ANA.username] }

  it('reads the window aggregates and the reader’s access', async () => {
    const { client } = fakeClient([{ data: probePayload({ entryCount: 40, seconds: 500_000 }) }])

    const probe = await gitLabGroupTimelogGateway(client).probe(query)

    expect(probe.declared).toEqual({ entryCount: 40, seconds: 500_000 })
    expect(probe.access).toEqual({ level: 20, name: 'REPORTER' })
  })

  it('coerces the total, which GitLab sends as a string', async () => {
    const { client } = fakeClient([{ data: probePayload({ seconds: 167_400 }) }])

    const probe = await gitLabGroupTimelogGateway(client).probe(query)

    expect(probe.declared.seconds).toBe(167_400)
  })

  it('sends each username as a variable rather than writing it into the document', async () => {
    const { client, sent } = fakeClient([{ data: probePayload() }])

    await gitLabGroupTimelogGateway(client).probe(query)

    expect(sent[0]?.query).toContain('$u0: String!')
    expect(sent[0]?.query).toContain('username: $u0')
    expect(sent[0]?.query).not.toContain(ANA.username)
    expect(sent[0]?.variables).toMatchObject({ u0: ANA.username })
  })

  it('keys each person’s totals back by the position it asked in', async () => {
    const { client } = fakeClient([
      {
        data: probePayload({
          perPerson: [
            { person: ANA, seconds: 167_400 },
            { person: BRUNO, seconds: 3600 },
          ],
        }),
      },
    ])

    const probe = await gitLabGroupTimelogGateway(client).probe({
      ...QUERY,
      usernames: [ANA.username, BRUNO.username],
    })

    expect(probe.perPerson.get(ANA.username)?.seconds).toBe(167_400)
    expect(probe.perPerson.get(BRUNO.username)?.seconds).toBe(3600)
  })

  it('splits a group larger than one batch across several requests', async () => {
    const many = Array.from({ length: 40 }, (_unused, index) => `person.${String(index)}`)
    const { client, sent } = fakeClient([{ data: probePayload({ perPerson: [] }) }])

    await gitLabGroupTimelogGateway(client).probe({ ...QUERY, usernames: many })

    expect(sent).toHaveLength(2)
  })

  it('asks about the window even when there is nobody to ask about', async () => {
    const { client, sent } = fakeClient([{ data: probePayload({ perPerson: [] }) }])

    await gitLabGroupTimelogGateway(client).probe({ ...QUERY, usernames: [] })

    expect(sent).toHaveLength(1)
    expect(sent[0]?.query).toContain('window: timelogs')
  })

  it('refuses a group it may not read', async () => {
    const { client } = fakeClient([{ data: { group: null }, errors: ['not authorized'] }])

    await expect(gitLabGroupTimelogGateway(client).probe(query)).rejects.toThrow(
      GraphQLRequestError,
    )
  })

  it('reports nothing declared for a group that does not resolve', async () => {
    const { client } = fakeClient([{ data: { group: null } }])

    const probe = await gitLabGroupTimelogGateway(client).probe(query)

    expect(probe).toMatchObject({ access: null, declared: { entryCount: 0, seconds: 0 } })
  })
})

describe('the roster', () => {
  it('asks for the group and its descendants, never for inherited membership', async () => {
    const { client, sent } = fakeClient([{ data: rosterPayload() }])

    await gitLabGroupTimelogGateway(client).roster({ fullPath: SQUAD_FISCAL.fullPath })

    expect(sent[0]?.query).toContain('relations: [DIRECT, DESCENDANTS]')
  })

  it('reads every page, so a large group loses nobody', async () => {
    const { client, sent } = fakeClient([
      { data: rosterPayload({ endCursor: 'MQ', hasNextPage: true, nodes: [memberNode(ANA)] }) },
      { data: rosterPayload({ hasNextPage: false, nodes: [memberNode(BRUNO)] }) },
    ])

    const answer = await gitLabGroupTimelogGateway(client).roster({
      fullPath: SQUAD_FISCAL.fullPath,
    })

    expect(sent).toHaveLength(2)
    expect(answer.members.map((one) => one.person.username)).toEqual([ANA.username, BRUNO.username])
  })

  it('carries whether an account is a bot and whether it is active', async () => {
    const { client } = fakeClient([
      {
        data: rosterPayload({
          nodes: [memberNode(ANA, { bot: true }), memberNode(BRUNO, { state: 'blocked' })],
        }),
      },
    ])

    const answer = await gitLabGroupTimelogGateway(client).roster({
      fullPath: SQUAD_FISCAL.fullPath,
    })

    expect(answer.members[0]).toMatchObject({ active: true, bot: true })
    expect(answer.members[1]).toMatchObject({ active: false, bot: false })
  })

  it('drops a membership whose person GitLab would not name', async () => {
    const { client } = fakeClient([
      { data: rosterPayload({ nodes: [{ accessLevel: null, user: null }, memberNode(ANA)] }) },
    ])

    const answer = await gitLabGroupTimelogGateway(client).roster({
      fullPath: SQUAD_FISCAL.fullPath,
    })

    expect(answer.members).toHaveLength(1)
  })
})

describe('the group picker', () => {
  it('reads the groups the reader is authorized in', async () => {
    const { client, sent } = fakeClient([{ data: groupsPayload() }])

    const groups = await gitLabGroupTimelogGateway(client).groups('fiscal')

    expect(sent[0]?.query).toContain('allAvailable: false')
    expect(sent[0]?.variables).toMatchObject({ search: 'fiscal' })
    expect(groups).toEqual([SQUAD_FISCAL])
  })

  it('reports nothing when GitLab resolved no groups', async () => {
    const { client } = fakeClient([{ data: { groups: null } }])

    const groups = await gitLabGroupTimelogGateway(client).groups(null)

    expect(groups).toEqual([])
  })
})
