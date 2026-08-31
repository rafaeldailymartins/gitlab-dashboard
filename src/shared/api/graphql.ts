/** The credential half of a session, as this client needs it. */
export interface Credentials {
  accessToken(): Promise<string>
  /** Called once when GitLab rejects a token this client believed was live. */
  refresh(): Promise<string>
}

/**
 * What an endpoint answered: its data, and whatever it would not resolve.
 *
 * Both, rather than one or the other. GraphQL reports a partly resolvable
 * request as data and errors together, and a client that chose between them
 * would either throw away entries the provider did answer with — which is the
 * defect this shape exists to prevent — or pass a short answer on as if it were
 * the whole of one.
 */
export interface GraphQLAnswer {
  readonly data: unknown
  /** Empty when the whole request resolved. */
  readonly errors: readonly string[]
}

export interface GraphQLClient {
  request(request: GraphQLRequest): Promise<GraphQLAnswer>
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
        return answerOf(first)
      }

      const retried = await send(endpoint, request, await credentials.refresh())

      if (retried.status === UNAUTHORIZED) {
        throw new GraphQLRequestError({ kind: 'unauthorized' })
      }

      return answerOf(retried)
    },
  }
}

/**
 * The answer inside a response, or a failure when there is nothing in it.
 *
 * Errors alone are a refusal. Errors beside data are a partial answer, and the
 * data in one is the reader's own: throwing it away is what left a dashboard
 * empty over three entries out of twenty-five.
 */
async function answerOf(response: Response): Promise<GraphQLAnswer> {
  if (!response.ok) {
    throw new GraphQLRequestError({ kind: 'unavailable' })
  }

  const payload = await readJson(response)
  const errors = errorMessagesOf(payload)
  const data = isRecord(payload) ? payload['data'] : undefined

  if (errors.length > 0 && !isUsable(data)) {
    throw new GraphQLRequestError({ kind: 'rejected', messages: errors })
  }

  return { data, errors }
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

/**
 * Whether there is anything in `data` worth handing on.
 *
 * A provider that resolved nothing sends `data: null` — or no `data` at all —
 * and errors saying why. Only that pairing is a refusal.
 */
function isUsable(data: unknown): boolean {
  return data !== undefined && data !== null
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
