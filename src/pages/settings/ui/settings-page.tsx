import { usePreferences } from '@/entities/preferences'
import { ThemeChoiceField } from '@/features/theme'
import { m } from '@/shared/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

import { DailyTargetFields } from './daily-target-fields'
import { LocaleField } from './locale-field'
import { TeamsCard } from './teams-card'
import { TimeZoneField } from './time-zone-field'

export function SettingsPage() {
  const { unsynced } = usePreferences()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{m.settings_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.settings_description()}</p>
      </header>

      {/* Said here and nowhere else, and said quietly. The values the reader
          just set are in effect — they were written to this device before
          anything was sent — so this is not a failure to act on, it is the one
          thing they could not otherwise find out. A setting that silently stops
          following somebody between machines is discovered months later, on the
          wrong figure. */}
      {unsynced ? (
        <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
          {m.settings_unsynced()}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{m.settings_schedule_title()}</CardTitle>
          <CardDescription>{m.settings_schedule_description()}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <DailyTargetFields />
          <TimeZoneField />
        </CardContent>
      </Card>

      <TeamsCard />

      <Card>
        <CardHeader>
          <CardTitle>{m.settings_appearance_title()}</CardTitle>
          <CardDescription>{m.settings_appearance_description()}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <LocaleField />
          <ThemeChoiceField />
        </CardContent>
      </Card>
    </main>
  )
}
