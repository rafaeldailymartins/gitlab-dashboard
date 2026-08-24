import { THEME_CHOICES, type ThemeChoice, usePreferences } from '@/entities/preferences'
import { m } from '@/shared/i18n'
import { SelectField } from '@/shared/ui/select-field'

const CHOICE_LABELS: Record<ThemeChoice, () => string> = {
  dark: m.theme_dark,
  light: m.theme_light,
  system: m.theme_system,
}

/** The full three-way choice, including following the operating system. */
export function ThemeChoiceField() {
  const { setThemeChoice, themeChoice } = usePreferences()

  return (
    <SelectField<ThemeChoice>
      label={m.theme_label()}
      onChange={setThemeChoice}
      options={THEME_CHOICES.map((choice) => ({ label: CHOICE_LABELS[choice](), value: choice }))}
      value={themeChoice}
    />
  )
}
