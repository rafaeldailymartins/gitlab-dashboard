import { readConfig } from '@/shared/config/env'
import { addDays, todayInTimeZone } from '@/shared/lib/date'

import { aggregateTimelogs } from '../model/aggregate'
import type { TimelogReport, TimelogUser } from '../model/types'
import { fetchMembers } from './fetch-members'
import { fetchTimelogs } from './fetch-timelogs'

export type ReportParams = {
  days: number
  username?: string
}

/** Monta o relatorio completo: busca timelogs no GitLab e agrega por dia. Roda apenas no servidor. */
export async function buildTimelogReport({ days, username }: ReportParams): Promise<TimelogReport> {
  const config = readConfig()
  const to = todayInTimeZone(config.timeZone)
  const from = addDays(to, -(days - 1))

  // Margem de 1 dia em cada ponta: o GitLab filtra a data em UTC, o bucketing final usa o fuso configurado
  const [{ entries, truncated }, members] = await Promise.all([
    fetchTimelogs(config, {
      end: addDays(to, 1),
      start: addDays(from, -1),
    }),
    fetchMembers(config),
  ])

  const { rows, totals, users } = aggregateTimelogs({
    from,
    timelogs: entries,
    timeZone: config.timeZone,
    to,
    username,
  })

  return {
    filter: { username: username ?? null },
    generatedAt: new Date().toISOString(),
    period: { days, from, timeZone: config.timeZone, to },
    rows,
    scope: {
      fullPath: config.scope.fullPath,
      type: config.scope.type,
      url: `${config.baseUrl}/${config.scope.fullPath}`,
    },
    totals,
    truncated,
    users: mergeUsers(members, users),
  }
}

/** Uniao de membros do escopo (quando o token pode lista-los) com autores de timelogs. */
function mergeUsers(members: TimelogUser[] | null, authors: TimelogUser[]): TimelogUser[] {
  const byUsername = new Map((members ?? []).map((user) => [user.username, user]))
  for (const author of authors) {
    byUsername.set(author.username, author)
  }
  return [...byUsername.values()].sort((left, right) => left.name.localeCompare(right.name))
}
