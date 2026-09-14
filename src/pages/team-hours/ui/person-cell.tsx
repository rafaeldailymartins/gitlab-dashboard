import type { GridRow } from '@/entities/group-timelogs'

import { m } from '@/shared/i18n'

/** How many letters an avatar carries. More than two stops reading as a mark. */
const INITIAL_COUNT = 2

/**
 * Who the row is about.
 *
 * The avatar is initials rather than the account's picture: a group's pictures
 * are a request per person to the provider's CDN, on a screen that already makes
 * one request per person for the probe, and this table's job is to be read at a
 * glance rather than to be a directory. It is `aria-hidden` — the name is right
 * beside it, and a rowheader announced as "AC Ana Carolina" reads the name
 * twice.
 */
export function PersonCell({ hidden, row }: { readonly hidden: boolean; readonly row: GridRow }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
      >
        {initialsOf(row.person.name)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium" title={row.person.name}>
          {row.person.name}
        </span>
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
