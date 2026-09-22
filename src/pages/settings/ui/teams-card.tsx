import { lazy, Suspense, useState } from 'react'

import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

/**
 * Mounted only once it has been asked for.
 *
 * It carries an editing surface, a group list and a person search, and settings
 * is a screen somebody opens to change a time zone. `no-restricted-exports`
 * holds every module here, so the default export is mapped rather than written.
 */
const TeamManagerDialog = lazy(async () =>
  import('@/widgets/team-manager').then((module) => ({ default: module.TeamManagerDialog })),
)

/**
 * The second way into the teams a reader keeps.
 *
 * A card rather than a fifth navigation link: "Equipes" beside "Equipe" at
 * 375 px is one word twice. The report is where a reader actually reaches this —
 * they notice a team is wrong while reading its month — and this is the entry
 * for somebody who came looking rather than noticing.
 *
 * A button rather than the underlined link it used to be, because it no longer
 * goes anywhere: the same dialog opens over whichever screen asked for it.
 */
export function TeamsCard() {
  const [managing, setManaging] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.settings_teams_title()}</CardTitle>
        <CardDescription>{m.settings_teams_description()}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => {
            setManaging(true)
          }}
          size="lg"
          type="button"
          variant="outline"
        >
          {m.settings_teams_link()}
        </Button>
        {managing ? (
          <Suspense fallback={null}>
            <TeamManagerDialog onOpenChange={setManaging} open />
          </Suspense>
        ) : null}
      </CardContent>
    </Card>
  )
}
