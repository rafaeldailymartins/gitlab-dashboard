/** The credential half of a session, as this client needs it. */
export interface Credentials {
  accessToken(): Promise<string>
  /** Called once when GitLab rejects a token this client believed was live. */
  refresh(): Promise<string>
}

export interface GraphQLClient {
  request(request: GraphQLRequest): Promise<unknown>
}

/** Why a GraphQL request did not produce data. */
export type GraphQLFailure =
  | { readonly kind: 'rejected'; readonly messages: readonly string[] }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'unavailable' }

interface GraphQLRequest {
  readonly query: string
  readonly signal?: AbortSignal
  readonly variables: Record<string, unknown>
}

/**
 * A GraphQL request that failed.
 *
 * The `kind` separates "your credential is no longer accepted" from "GitLab is
 * unreachable" from "GitLab understood the request and refused it", because the
 * interface says something different for each and only one of them is worth a
 * retry button.
 */
export class GraphQLRequestError extends Error {
  readonly failure: GraphQLFailure

  constructor(failure: GraphQLFailure) {
    super(`GraphQL request failed: ${failure.kind}`)

    this.failure = failure
    this.name = 'GraphQLRequestError'
  }
}

const UNAUTHORIZED = 401

/**
 * Posts GraphQL to an endpoint with a bearer credential.
 *
 * A single rejected-credential retry lives here rather than in every caller: a
 * token can expire between being read and being used, and renewal is
 * single-flight upstream, so a burst of requests still causes one renewal.
 */
export function graphQLClient(endpoint: string, credentials: Credentials): GraphQLClient {
  return {
    async request(request) {
      const first = await send(endpoint, request, await credentials.accessToken())

      if (first.status !== UNAUTHORIZED) {
        return dataOf(first)
      }

      const retried = await send(endpoint, request, await credentials.refresh())

      if (retried.status === UNAUTHORIZED) {
        throw new GraphQLRequestError({ kind: 'unauthorized' })
      }

      return dataOf(retried)
    },
  }
}

async function dataOf(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new GraphQLRequestError({ kind: 'unavailable' })
  }

  const payload = await readJson(response)
  const errors = errorMessagesOf(payload)

  if (errors.length > 0) {
    throw new GraphQLRequestError({ kind: 'rejected', messages: errors })
  }

  return isRecord(payload) ? payload['data'] : undefined
}

/**
 * GraphQL reports failures inside a 200 response, so the body has to be read
 * before a request can be called successful.
 */
function errorMessagesOf(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload['errors'])) {
    return []
  }

  return payload['errors'].map((error) =>
    isRecord(error) && typeof error['message'] === 'string' ? error['message'] : 'Unknown error',
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    throw new GraphQLRequestError({ kind: 'unavailable' })
  }
}

async function send(
  endpoint: string,
  request: GraphQLRequest,
  accessToken: string,
): Promise<Response> {
  try {
    return await fetch(endpoint, {
      body: JSON.stringify({ query: request.query, variables: request.variables }),
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      ...(request.signal ? { signal: request.signal } : {}),
    })
  } catch (error) {
    // An aborted request is the caller changing its mind, not a failure.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new GraphQLRequestError({ kind: 'unavailable' })
  }
}
