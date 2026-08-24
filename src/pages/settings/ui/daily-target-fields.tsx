import { usePreferences, withDailyTarget, withWeekdayTarget } from '@/entities/preferences'
import { m, useActiveLocale } from '@/shared/i18n'
import { WEEKDAYS } from '@/shared/lib/date'
import { shortWeekdayName } from '@/shared/lib/format'

import { WeekdayTargetInput } from './weekday-target-input'

export function DailyTargetFields() {
  const { preferences, setPreferences } = usePreferences()
  const { locale } = useActiveLocale()

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">{m.daily_target_legend()}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {WEEKDAYS.map((weekday) => (
          <WeekdayTargetInput
            hours={preferences.dailyTarget[weekday]}
            key={weekday}
            label={shortWeekdayName(weekday, locale)}
            onCommit={(hours) => {
              setPreferences(
                withDailyTarget(
                  preferences,
                  withWeekdayTarget(preferences.dailyTarget, weekday, hours),
                ),
              )
            }}
          />
        ))}
      </div>
    </fieldset>
  )
}
