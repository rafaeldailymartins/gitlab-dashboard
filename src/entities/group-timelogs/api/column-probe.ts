import type { GraphQLClient } from '@/shared/api'

import type { ColumnProbeAnswer, ColumnProbeQuery } from '../model/ports'
import type { DeclaredTotals } from '../model/ports'

import { columnAlias, columnFrom, columnTo, groupColumnProbe } from './documents'
import { declaredTotalsSchema, groupColumnProbePayloadSchema } from './schemas'

/** What the provider says about somebody it would not resolve at all. */
const NOTHING_DECLARED: ColumnProbeAnswer = {
  byColumn: new Map(),
  period: { entryCount: 0, seconds: 0 },
}

/**
 * One person's period, column by column.
 *
 * In a file of its own rather than in the gateway beside the other readers: the
 * gateway is within a few lines of the 200-line ceiling, and this reader brings
 * its own variable building with it.
 *
 * A group the reader may not read answers `group: null`, and this returns
 * nothing declared rather than throwing. The caller already has a report on
 * screen by the time this runs — the placement is an improvement to it, not the
 * thing itself — so a refusal here must cost the marks and never the report.
 */
export async function readColumnProbe(
  client: GraphQLClient,
  query: ColumnProbeQuery,
  signal?: AbortSignal,
): Promise<ColumnProbeAnswer> {
  const answer = await client.request({
    query: groupColumnProbe(query.columns.length),
    variables: variablesOf(query),
    ...(signal ? { signal } : {}),
  })
  const { group } = groupColumnProbePayloadSchema.parse(answer.data)

  if (!group) {
    return NOTHING_DECLARED
  }

  return {
    byColumn: byColumnOf(group, query.columns),
    period: declaredOf(group.period),
  }
}

/**
 * Each column's totals, read back by the position they were sent in.
 *
 * A column the provider would not answer for is left out of the map rather than
 * recorded as zero. `model/withheld.ts` refuses a declaration with a column
 * missing, which is what stops "we could not read this span" from being taken
 * for "nothing was withheld in it".
 */
function byColumnOf(
  group: Record<string, unknown>,
  columns: ColumnProbeQuery['columns'],
): ReadonlyMap<string, DeclaredTotals> {
  const totals = new Map<string, DeclaredTotals>()

  for (const [index, column] of columns.entries()) {
    const parsed = declaredTotalsSchema.safeParse(group[columnAlias(index)])

    if (parsed.success) {
      totals.set(column.key, declaredOf(parsed.data))
    }
  }

  return totals
}

function declaredOf(declared: { count: number; totalSpentTime: number }): DeclaredTotals {
  return { entryCount: declared.count, seconds: declared.totalSpentTime }
}

function variablesOf(query: ColumnProbeQuery): Record<string, unknown> {
  const spans: Record<string, string> = {}

  for (const [index, column] of query.columns.entries()) {
    spans[columnFrom(index)] = column.from
    spans[columnTo(index)] = column.to
  }

  return {
    from: query.from,
    fullPath: query.fullPath,
    to: query.to,
    user: query.username,
    ...spans,
  }
}
