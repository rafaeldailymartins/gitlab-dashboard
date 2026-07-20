export class GitLabApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GitLabApiError'
    this.status = status
  }
}

type GraphqlParams = {
  baseUrl: string
  query: string
  token: string
  variables?: Record<string, unknown>
}

/** Executa uma query GraphQL na API do GitLab. Chamar apenas no servidor. */
export async function gitlabGraphql<TData>({ baseUrl, query, token, variables }: GraphqlParams): Promise<TData> {
  const response = await fetch(`${baseUrl}/api/graphql`, {
    body: JSON.stringify({ query, variables }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new GitLabApiError(statusMessage(response.status), response.status)
  }

  const payload = (await response.json()) as {
    data?: TData
    errors?: { message: string }[]
  }

  if (payload.errors?.length) {
    throw new GitLabApiError(`GitLab retornou erro: ${payload.errors.map((error) => error.message).join('; ')}`)
  }

  if (!payload.data) {
    throw new GitLabApiError('GitLab retornou resposta vazia.')
  }

  return payload.data
}

function statusMessage(status: number) {
  if (status === 401) return 'Token do GitLab invalido ou expirado (401). Verifique GITLAB_TOKEN no .env.'
  if (status === 403) return 'Token do GitLab sem permissao para esta consulta (403). O escopo read_api e acesso Reporter+ sao necessarios.'
  return `GitLab respondeu com status ${status}.`
}
