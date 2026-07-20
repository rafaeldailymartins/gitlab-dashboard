export const DEFAULT_DAYS = 7

export type ReportSearch = {
  days: number
  user?: string
}

/** Valida os search params compartilhados pelas rotas do relatorio. */
export function parseReportSearch(search: Record<string, unknown>): ReportSearch {
  const days = Number(search.days)
  const user = typeof search.user === 'string' && search.user.length > 0 ? search.user : undefined

  return {
    days: Number.isInteger(days) && days >= 1 && days <= 366 ? days : DEFAULT_DAYS,
    ...(user ? { user } : {}),
  }
}
