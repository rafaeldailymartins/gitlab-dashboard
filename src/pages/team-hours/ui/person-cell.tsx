import type { GridRow } from '@/entities/team-timelogs'

import { m } from '@/shared/i18n'

import { rowName, rowUsername } from '../lib/naming'

/** How many letters an avatar carries. More than two stops reading as a mark. */
const INITIAL_COUNT = 2

/**
 * Who the row is about.
 *
 * The avatar is initials rather than the account's picture: a team's pictures
 * are a request per person to the provider's CDN, and this table's job is to be
 * read at a glance rather than to be a directory. It is `aria-hidden` — the name
 * is right beside it, and a rowheader announced as "AC Ana Carolina" reads the
 * name twice.
 *
 * The name comes from the provider when it resolved the person and from what the
 * reader stored when it did not, so a row is never an identifier — see
 * `lib/naming.ts`. A row the provider would not resolve says so under the name,
 * because a row of empty cells beside somebody's name with no explanation reads
 * as a month they did not work.
 */
export function PersonCell({ hidden, row }: { readonly hidden: boolean; readonly row: GridRow }) {
  const name = rowName(row)

  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
      >
        {initialsOf(name)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium" title={name}>
          {name}
        </span>
        {row.identity.kind === 'confirmed' ? null : (
          <span className="truncate text-[11px] text-muted-foreground">
            {m.team_row_unresolved({ username: rowUsername(row) })}
          </span>
        )}
        {hidden ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {m.team_row_all_hidden()}
          </span>
        ) : null}
      </span>
    </span>
  )
}

/** Graphemes, not code units: a letter is what a reader would call one. */
const letters = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function firstLetterOf(word: string): string {
  for (const { segment } of letters.segment(word)) {
    return segment
  }

  return ''
}

/**
 * The first letter of the first name and of the last.
 *
 * Through `Intl.Segmenter` rather than an index: the first character of a name
 * can be a code unit that means nothing on its own, and cutting one in half
 * renders a replacement glyph beside somebody's name.
 */
function initialsOf(name: string): string {
  const words = name.split(' ').filter((word) => word !== '')
  const picked = words.length <= 1 ? words : [words[0], words.at(-1)]

  return picked
    .map((word) => firstLetterOf(word ?? ''))
    .join('')
    .slice(0, INITIAL_COUNT)
    .toUpperCase()
}
