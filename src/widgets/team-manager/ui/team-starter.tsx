import { useId } from 'react'

import type { GroupRef } from '@/entities/team-timelogs'

import { m } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'

import { GroupList } from './group-list'
import { PaneHeading } from './pane-heading'

interface TeamStarterProps {
  /** The group being read, so its row can say so and the rest can wait. */
  readonly busy: null | string
  /** The way back to the team that was showing, or null when there was none. */
  readonly onBack: (() => void) | null
  readonly onBlank: () => void
  readonly onGroup: (group: GroupRef) => void
}

/**
 * A team, in one action.
 *
 * The reader names a squad and gets the squad. This replaces a group combobox
 * followed by a plus beside each person, which asked them to re-answer, one name
 * at a time, the question they had already answered by naming the group — and
 * spent a conditional write on each of those answers.
 *
 * A group is a **template** here, and the wording is the design. It is not a
 * subscription and not a filter: what it produces is a team the reader owns from
 * that moment, which is why the sentence promises they can change who is on it
 * rather than explaining how far back the provider was read. That window used to
 * be stated here and is not any more — see `use-group-seeding.ts` for what that
 * costs and why it stopped being the reader's problem.
 *
 * Starting blank is kept and is not the first thing offered. It is the only way
 * to build a team of people who have logged nothing yet — a new joiner, most
 * often — but it is the rarer errand, and putting it first would make every
 * reader walk past the fast path to reach the slow one.
 */
export function TeamStarter({ busy, onBack, onBlank, onGroup }: TeamStarterProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="flex min-h-0 flex-col gap-3 p-5">
      {onBack === null ? (
        <h2 className="text-sm font-semibold" id={headingId}>
          {m.teams_start_heading()}
        </h2>
      ) : (
        <PaneHeading id={headingId} onBack={onBack} title={m.teams_start_heading()} />
      )}

      <p className="text-sm text-muted-foreground">{m.teams_start_description()}</p>

      <GroupList busy={busy} label={m.teams_group_search_label()} onChoose={onGroup} />

      <div className="flex items-center gap-3 pt-1 text-sm text-muted-foreground">
        <span aria-hidden className="h-px flex-1 bg-border" />
        {m.teams_start_or()}
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>

      <Button
        className="self-center"
        disabled={busy !== null}
        onClick={onBlank}
        size="lg"
        type="button"
        variant="outline"
      >
        {m.teams_start_blank()}
      </Button>
    </section>
  )
}
