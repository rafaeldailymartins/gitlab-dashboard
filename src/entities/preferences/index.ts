export { preferencesStore } from './api/preferences-store'
export {
  isValidTargetHours,
  MAX_TARGET_HOURS,
  targetForDate,
  targetForDates,
  targetProgress,
  withWeekdayTarget,
} from './model/daily-target'
export type { DailyTarget } from './model/daily-target'

export { withDailyTarget, withTimeZone } from './model/preferences'
export { THEME_CHOICES, type ThemeChoice } from './model/theme'
export { PreferencesProvider, usePreferences } from './ui/preferences-provider'
