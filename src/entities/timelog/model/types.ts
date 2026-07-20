export type TimelogUser = {
  name: string
  username: string
}

export type WorkItemType = 'issue' | 'mr'

export type WorkItemRef = {
  /** Referencia curta no formato do GitLab, ex.: "grupo/projeto#12" ou "grupo/projeto!34" */
  key: string
  title: string
  type: WorkItemType
  url: string
}

/** Um registro de tempo normalizado, como veio do GitLab. */
export type TimelogEntry = {
  item: WorkItemRef | null
  seconds: number
  spentAt: string
  summary: string | null
  user: TimelogUser
}

export type ItemBreakdown = WorkItemRef & {
  entryCount: number
  hours: number
  seconds: number
}

export type UserBreakdown = TimelogUser & {
  entryCount: number
  hours: number
  seconds: number
}

export type DayRow = {
  /** YYYY-MM-DD no fuso configurado */
  date: string
  entryCount: number
  hours: number
  items: ItemBreakdown[]
  seconds: number
  users: UserBreakdown[]
}

export type ReportTotals = {
  entryCount: number
  hours: number
  itemCount: number
  seconds: number
  userCount: number
}

export type TimelogReport = {
  filter: { username: string | null }
  generatedAt: string
  period: { days: number; from: string; timeZone: string; to: string }
  rows: DayRow[]
  scope: { fullPath: string; type: 'group' | 'project'; url: string }
  totals: ReportTotals
  truncated: boolean
  /** Todos os usuarios com registros no periodo, independente do filtro. */
  users: TimelogUser[]
}
