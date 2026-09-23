// zod 4's documented import form, matching `netlify/lib/teams-document.mts`.
import * as z from 'zod'

import type { DocumentKind } from './handle-document.mjs'

/**
 * The reader's settings, as the endpoint will accept them.
 *
 * A strict validator where the browser's is lenient, and deliberately the same
 * pair as the teams document: recovering from something already stored and
 * deciding what may be stored at all are different questions.
 * `preferences-contract.test.mts` is what keeps the two agreeing in the
 * direction that matters — everything the browser writes, this accepts.
 *
 * Only what is about the **person** is here. The colour scheme and the language
 * are about the device in front of somebody — and the theme is applied before
 * the first paint, which a value fetched over the network cannot be.
 */

/** Seven weekdays, ISO numbering, Monday first. */
const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '7'] as const

/**
 * The most a full day may be said to be.
 *
 * Twenty-four, because a day has that many hours and a target above one is not a
 * schedule anybody could keep. Mirrors `MAX_TARGET_HOURS` in the browser.
 */
const MAX_TARGET_HOURS = 24

/**
 * A bound the body is refused past, far above anything this document can be.
 *
 * Seven numbers, a zone name and an instant is a few hundred bytes. Two
 * kilobytes leaves room for a field somebody adds later and still refuses a
 * caller sending a megabyte at an endpoint that has to answer it.
 */
const MAX_BODY_BYTES = 2 * 1024

const dailyTargetSchema = z.object(
  Object.fromEntries(
    WEEKDAYS.map((day) => [day, z.number().min(0).max(MAX_TARGET_HOURS)] as const),
  ) as Record<(typeof WEEKDAYS)[number], z.ZodNumber>,
)

/**
 * The zone is checked for being a zone, not merely for being a string.
 *
 * `Intl` is the only authority on that and it is in every runtime this code
 * meets, so an unknown name is refused here rather than stored and found later
 * by a screen trying to cut a day with it.
 */
const timeZoneSchema = z.string().refine((value) => {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone !== ''
  } catch {
    return false
  }
}, 'not a recognised IANA time zone')

const documentSchema = z.object({
  dailyTarget: dailyTargetSchema,
  timeZone: timeZoneSchema,
  /**
   * When the reader last changed any of this.
   *
   * It is what makes two devices resolvable without asking anybody: the later
   * write wins. Stored rather than derived from the write, because a store's own
   * clock is not the one the reader made the change on.
   */
  updatedAt: z.iso.datetime(),
  version: z.literal(1),
})

/**
 * What a reader who has stored nothing is answered with.
 *
 * Null rather than a document full of defaults. The device already holds
 * defaults, and what it needs from this endpoint is the difference between "the
 * store has never heard of me" — send mine — and "the store holds something
 * older than mine" — send mine, but name the version. A document of defaults
 * would answer neither.
 */
const EMPTY_DOCUMENT = null

/**
 * The document kind the preferences endpoint is built from.
 *
 * `suffix` is a constant chosen here, not a value read from a request — which
 * is what keeps `handle-document.mts`'s key derivation the property it claims to
 * be.
 */
export const PREFERENCES_DOCUMENT: DocumentKind = {
  empty: EMPTY_DOCUMENT,
  maxBytes: MAX_BODY_BYTES,
  parse: parseDocument,
  suffix: '/preferences',
}

function parseDocument(text: string): { document: unknown; ok: true } | { ok: false } {
  try {
    const parsed = documentSchema.safeParse(JSON.parse(text))

    return parsed.success ? { document: parsed.data, ok: true } : { ok: false }
  } catch {
    return { ok: false }
  }
}
