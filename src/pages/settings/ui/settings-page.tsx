import { ThemeChoiceField } from '@/features/theme'
import { m } from '@/shared/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

import { DailyTargetFields } from './daily-target-fields'
import { LocaleField } from './locale-field'
import { TeamsCard } from './teams-card'
import { TimeZoneField } from './time-zone-field'

export function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{m.settings_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.settings_description()}</p>
      </header>

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
