import 'dotenv/config'

import { z } from 'zod'

const envSchema = z.object({
  GITLAB_BASE_URL: z.string().min(1).default('https://gitlab.com'),
  GITLAB_GROUP_PATH: z.string().min(1).optional(),
  GITLAB_PROJECT_PATH: z.string().min(1).optional(),
  GITLAB_TIME_ZONE: z.string().min(1).default('America/Sao_Paulo'),
  GITLAB_TOKEN: z.string().min(1),
})

export type GitLabScope = {
  fullPath: string
  type: 'group' | 'project'
}

export type AppConfig = {
  baseUrl: string
  scope: GitLabScope
  timeZone: string
  token: string
}

/** Le e valida as variaveis de ambiente. Chamar apenas no servidor. */
export function readConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Configuracao invalida. Verifique no .env: ${missing}. Use .env.example como base.`)
  }

  const { GITLAB_GROUP_PATH: groupPath, GITLAB_PROJECT_PATH: projectPath } = parsed.data

  if (Boolean(groupPath) === Boolean(projectPath)) {
    throw new Error('Configure exatamente um entre GITLAB_GROUP_PATH e GITLAB_PROJECT_PATH no .env.')
  }

  return {
    baseUrl: parsed.data.GITLAB_BASE_URL.replace(/\/$/, ''),
    scope: groupPath ? { fullPath: groupPath, type: 'group' } : { fullPath: projectPath!, type: 'project' },
    timeZone: parsed.data.GITLAB_TIME_ZONE,
    token: parsed.data.GITLAB_TOKEN,
  }
}
