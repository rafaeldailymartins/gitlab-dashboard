import type { GraphQLClient } from '@/shared/api'

/**
 * The client and the caller's abort signal, travelling together.
 *
 * They are one thing — how to reach GitLab for this request — and threading them
 * separately put several of the readers over the parameter ceiling.
 */
export interface Reader {
  readonly client: GraphQLClient
  readonly signal: AbortSignal | undefined
}

export async function ask(reader: Reader, query: string, variables: Record<string, unknown>) {
  return reader.client.request({
    query,
    variables,
    ...(reader.signal ? { signal: reader.signal } : {}),
  })
}

/** GitLab's own default maximum page size. Asking for more is silently capped. */
export const PAGE_SIZE = 100
