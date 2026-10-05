import { addDays, endOfMonth, type IsoDate, startOfMonth, startOfWeek } from '@/shared/lib/date'

import type { DateRange } from './aggregate'

import { periodSummary, type PeriodSummary, type TimelogReport } from './report'

const LAST_DAY_OF_WEEK = 6

/** The three periods a screen summarises around one day. */
export interface Periods {
  readonly day: DateRange
  readonly month: DateRange
  readonly week: DateRange
}

/** Each period's total, and whether all of them are answers rather than floors. */
export interface PeriodSummaries {
  readonly day: PeriodSummary
  readonly month: PeriodSummary
  /**
   * True once every period is settled.
   *
   * The week as well as the month: a week that began in the previous month
   * starts before the month does, so the month being settled says nothing
   * about it.
   */
  readonly settled: boolean
  readonly week: PeriodSummary
}

/** The day itself, the Monday-to-Sunday week containing it, and its calendar month. */
export function periodsOf(day: IsoDate): Periods {
  const weekStart = startOfWeek(day)

  return {
    day: { from: day, to: day },
    month: { from: startOfMonth(day), to: endOfMonth(day) },
    week: { from: weekStart, to: addDays(weekStart, LAST_DAY_OF_WEEK) },
  }
}

/** The periods of `day`, each totalled from what the report has loaded. */
export function periodSummaries(report: TimelogReport, day: IsoDate): PeriodSummaries {
  const periods = periodsOf(day)
  const month = periodSummary(report, periods.month)
  const week = periodSummary(report, periods.week)

  return {
    day: periodSummary(report, periods.day),
    month,
    settled: month.settled && week.settled,
    week,
  }
}
