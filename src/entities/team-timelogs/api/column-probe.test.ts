import { describe, expect, it, vi } from 'vitest'
import { ANA, SQUAD_FISCAL } from '~tests/support/gitlab-team-timelogs'

import type { GraphQLAnswer, GraphQLClient } from '@/shared/api'

import type { ColumnProbeQuery } from '../model/ports'

import { readColumnProbe } from './column-probe'

const HOUR = 3600

const COLUMNS = [
  { from: '2026-05-04T03:00:00.000Z', key: '2026-05-04', to: '2026-05-05T02:59:59.999999Z' },
  { from: '2026-05-05T03:00:00.000Z', key: '2026-05-05', to: '2026-05-06T02:59:59.999999Z' },
]

const QUERY: ColumnProbeQuery = {
  columns: COLUMNS,
  from: COLUMNS[0]?.from ?? '',
  groupId: null,
  memberId: ANA.id,
  to: COLUMNS[1]?.to ?? '',
}

/** What GitLab answers: the period, and one alias per column, by position. */
function answer(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      user: {
        c0: { count: 2, totalSpentTime: String(9 * HOUR) },
        c1: { count: 0, totalSpentTime: '0' },
        id: ANA.id,
        period: { count: 2, totalSpentTime: String(9 * HOUR) },
        ...overrides,
      },
    },
  }
}

function fakeReader(payload: Partial<GraphQLAnswer>, signal?: AbortSignal) {
  const sent: { query: string; variables: Record<string, unknown> }[] = []
  const request = vi.fn((asked: Parameters<GraphQLClient['request']>[0]) => {
    sent.push({ query: asked.query, variables: asked.variables })

    return Promise.resolve({ data: payload.data, errors: payload.errors ?? [] })
  })
  const client = { request } satisfies GraphQLClient

  return { client, reader: { client, signal }, sent }
}

describe('readColumnProbe', () => {
  it('keys each answer back by the column it was asked for', async () => {
    const { reader } = fakeReader(answer())

    const read = await readColumnProbe(reader, QUERY)

    expect(read.byColumn.get('2026-05-04')).toEqual({ entryCount: 2, seconds: 9 * HOUR })
    expect(read.byColumn.get('2026-05-05')).toEqual({ entryCount: 0, seconds: 0 })
  })

  it('reads the period the spans are checked against', async () => {
    const { reader } = fakeReader(answer())

    const read = await readColumnProbe(reader, QUERY)

    expect(read.period).toEqual({ entryCount: 2, seconds: 9 * HOUR })
  })

  it('sends every span as a variable, never inside the document', async () => {
    const { reader, sent } = fakeReader(answer())

    await readColumnProbe(reader, QUERY)

    expect(sent[0]?.variables).toMatchObject({
      f0: COLUMNS[0]?.from,
      t0: COLUMNS[0]?.to,
      user: ANA.id,
    })
    expect(sent[0]?.query).not.toContain(COLUMNS[0]?.from ?? 'never')
  })

  it('addresses the person by the provider’s own identifier', async () => {
    // A username can be released on rename and claimed by another account. The
    // id is what makes asking about the wrong person unexpressible.
    const { reader, sent } = fakeReader(answer())

    await readColumnProbe(reader, QUERY)

    expect(sent[0]?.query).toContain('user(id: $user)')
    expect(sent[0]?.variables['user']).toBe(ANA.id)
  })

  it('narrows every alias to the same group as the figures, or to none', async () => {
    // An instrument measuring a different set than the figures makes every
    // shortfall on the screen nonsense, and does it silently.
    const { reader, sent } = fakeReader(answer())

    await readColumnProbe(reader, { ...QUERY, groupId: SQUAD_FISCAL.id })

    expect(sent[0]?.variables['group']).toBe(SQUAD_FISCAL.id)
    expect(sent[0]?.query).toContain('period: timelogs(groupId: $group')
    expect(sent[0]?.query).toContain('c0: timelogs(groupId: $group')
  })

  it('asks the whole reach when nothing narrows it', async () => {
    const { reader, sent } = fakeReader(answer())

    await readColumnProbe(reader, QUERY)

    expect(sent[0]?.variables['group']).toBeNull()
  })

  it('asks one alias per column, and one for the period', async () => {
    const { reader, sent } = fakeReader(answer())

    await readColumnProbe(reader, QUERY)

    expect(sent[0]?.query).toContain('c0: timelogs(')
    expect(sent[0]?.query).toContain('c1: timelogs(')
    expect(sent[0]?.query).toContain('period: timelogs(')
  })

  it('coerces the string the provider serialises a BigInt as', async () => {
    // `totalSpentTime` arrives as a string, which is how GraphQL serialises a
    // BigInt. A fixture that disagreed would pass while the app failed.
    const { reader } = fakeReader(answer({ c0: { count: 1, totalSpentTime: '3600' } }))

    const read = await readColumnProbe(reader, QUERY)

    expect(read.byColumn.get('2026-05-04')?.seconds).toBe(HOUR)
  })

  it('leaves out a column the provider would not answer for', async () => {
    // Left out rather than recorded as zero: `model/withheld.ts` refuses a
    // declaration with a column missing, and that refusal is the whole point.
    const { reader } = fakeReader(answer({ c1: null }))

    const read = await readColumnProbe(reader, QUERY)

    expect(read.byColumn.has('2026-05-05')).toBe(false)
  })

  it('declares nothing for somebody it may not read, rather than throwing', async () => {
    // The report is already on screen by the time this runs. A refusal here
    // costs the marks; it must never cost the report.
    const { reader } = fakeReader({ data: { user: null } })

    expect(await readColumnProbe(reader, QUERY)).toEqual({
      byColumn: new Map(),
      period: { entryCount: 0, seconds: 0 },
    })
  })

  it('passes the caller’s abort signal through', async () => {
    const controller = new AbortController()
    const { client, reader } = fakeReader(answer(), controller.signal)

    await readColumnProbe(reader, QUERY)

    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('sends no signal when the caller gave none', async () => {
    const { client, reader } = fakeReader(answer())

    await readColumnProbe(reader, QUERY)

    expect(client.request).toHaveBeenCalledWith(expect.not.objectContaining({ signal: undefined }))
  })
})
