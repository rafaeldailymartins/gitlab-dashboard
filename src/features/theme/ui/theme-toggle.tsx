import { Moon, Sun } from 'lucide-react'

import { usePreferences } from '@/entities/preferences'
import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

/**
 * Flips between light and dark. It sets an explicit choice, so a reader who
 * uses it stops following the system; "follow my system" stays available in
 * settings, where there is room to explain it.
 */
export function ThemeToggle() {
  const { resolvedTheme, setThemeChoice } = usePreferences()
  const goingDark = resolvedTheme === 'light'

  return (
    <Button
      aria-label={goingDark ? m.theme_switch_to_dark() : m.theme_switch_to_light()}
      onClick={() => {
        setThemeChoice(goingDark ? 'dark' : 'light')
      }}
      size="icon-sm"
      variant="ghost"
    >
      {goingDark ? <Moon aria-hidden /> : <Sun aria-hidden />}
    </Button>
  )
}
