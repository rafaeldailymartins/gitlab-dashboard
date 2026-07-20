import { dateInTimeZone } from '@/shared/lib/date'

import type { DayRow, ReportTotals, TimelogEntry, TimelogUser, WorkItemRef } from './types'

export type AggregateInput = {
  /** Primeira data do periodo (YYYY-MM-DD), inclusiva */
  from: string
  timelogs: TimelogEntry[]
  timeZone: string
  /** Ultima data do periodo (YYYY-MM-DD), inclusiva */
  to: string
  username?: string
}

export type AggregateResult = {
  rows: DayRow[]
  totals: ReportTotals
  users: TimelogUser[]
}

/** Agrega timelogs em linhas por dia, com breakdown por item e por usuario. */
export function aggregateTimelogs({ from, timelogs, timeZone, to, username }: AggregateInput): AggregateResult {
  const users = collectUsers(timelogs)
  const filtered = username ? timelogs.filter((entry) => entry.user.username === username) : timelogs
  const days = new Map<string, DayAccumulator>()

  for (const entry of filtered) {
    if (!entry.seconds) continue

    const date = dateInTimeZone(entry.spentAt, timeZone)
    if (date < from || date > to) continue

    const day = days.get(date) ?? { date, entryCount: 0, items: new Map(), seconds: 0, users: new Map() }

    day.seconds += entry.seconds
    day.entryCount += 1
    accumulate(day.users, entry.user.username, entry.user, entry.seconds)
    if (entry.item) accumulate(day.items, entry.item.key, entry.item, entry.seconds)

    days.set(date, day)
  }

  const rows = [...days.values()]
    .map(toDayRow)
    .sort((left, right) => right.date.localeCompare(left.date))

  return { rows, totals: computeTotals(rows), users }
}

export function secondsToHours(seconds: number) {
  return Math.round((seconds / 3600) * 100) / 100
}

type Accumulated<T> = T & { entryCount: number; seconds: number }

type DayAccumulator = {
  date: string
  entryCount: number
  items: Map<string, Accumulated<WorkItemRef>>
  seconds: number
  users: Map<string, Accumulated<TimelogUser>>
}

function accumulate<T>(bucket: Map<string, Accumulated<T>>, key: string, base: T, seconds: number) {
  const current = bucket.get(key) ?? { ...base, entryCount: 0, seconds: 0 }
  current.seconds += seconds
  current.entryCount += 1
  bucket.set(key, current)
}

function toDayRow(day: DayAccumulator): DayRow {
  return {
    date: day.date,
    entryCount: day.entryCount,
    hours: secondsToHours(day.seconds),
    items: sortBySeconds([...day.items.values()].map(withHours)),
    seconds: day.seconds,
    users: sortBySeconds([...day.users.values()].map(withHours)),
  }
}

function withHours<T extends { seconds: number }>(value: T) {
  return { ...value, hours: secondsToHours(value.seconds) }
}

function sortBySeconds<T extends { seconds: number }>(values: T[]) {
  return values.sort((left, right) => right.seconds - left.seconds)
}

function computeTotals(rows: DayRow[]): ReportTotals {
  const seconds = rows.reduce((total, row) => total + row.seconds, 0)
  const itemKeys = new Set(rows.flatMap((row) => row.items.map((item) => item.key)))
  const usernames = new Set(rows.flatMap((row) => row.users.map((user) => user.username)))

  return {
    entryCount: rows.reduce((total, row) => total + row.entryCount, 0),
    hours: secondsToHours(seconds),
    itemCount: itemKeys.size,
    seconds,
    userCount: usernames.size,
  }
}

function collectUsers(timelogs: TimelogEntry[]): TimelogUser[] {
  const byUsername = new Map<string, TimelogUser>()
  for (const entry of timelogs) {
    byUsername.set(entry.user.username, entry.user)
  }
  return [...byUsername.values()].sort((left, right) => left.name.localeCompare(right.name))
}
