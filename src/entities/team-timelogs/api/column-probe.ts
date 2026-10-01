import type { ColumnProbeAnswer, ColumnProbeQuery, DeclaredTotals } from '../model/ports'

import { columnAlias, columnFrom, columnTo, teamColumnProbe } from './documents'
import { ask, type Reader } from './reader'
import { declaredTotalsSchema, teamColumnProbePayloadSchema } from './schemas'

/** What the provider says about somebody it would not resolve at all. */
const NOTHING_DECLARED: ColumnProbeAnswer = {
  byColumn: new Map(),
  period: { entryCount: 0, seconds: 0 },
}

/**
 * One person's period, column by column.
 *
 * In a file of its own rather than in the gateway beside the other readers: the
 * gateway would be within a few lines of the 200-line ceiling, and this reader
 * brings its own variable building with it.
 *
 * Somebody the provider will not resolve answers `user: null`, and this returns
 * nothing declared rather than throwing. The caller already has a report on
 * screen by the time this runs — the placement is an improvement to it, not the
 * thing itself — so a refusal here must cost the marks and never the report.
 */
export async function readColumnProbe(
  reader: Reader,
  query: ColumnProbeQuery,
): Promise<ColumnProbeAnswer> {
  const answer = await ask(reader, teamColumnProbe(query.columns.length), variablesOf(query))
  const { user } = teamColumnProbePayloadSchema.parse(answer.data)

  if (!user) {
    return NOTHING_DECLARED
  }

  return {
    byColumn: byColumnOf(user, query.columns),
    period: declaredOf(user.period),
  }
}

/**
 * Each column's totals, read back by the position they were sent in.
 *
 * A column the provider would not answer for is left out of the map rather than
 * recorded as zero. `model/withheld.ts` refuses a declaration whose missing
 * column would hide an entry, which is what stops "we could not read this span" from being taken
 * for "nothing was withheld in it".
 */
function byColumnOf(
  user: Record<string, unknown>,
  columns: ColumnProbeQuery['columns'],
): ReadonlyMap<string, DeclaredTotals> {
  const totals = new Map<string, DeclaredTotals>()

  for (const [index, column] of columns.entries()) {
    const parsed = declaredTotalsSchema.safeParse(user[columnAlias(index)])

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
    group: query.groupId,
    to: query.to,
    user: query.memberId,
    ...spans,
  }
}
