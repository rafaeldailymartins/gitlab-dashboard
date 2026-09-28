// zod 4's documented import form, matching `src/entities/*/api/schemas.ts`.
import * as z from 'zod'

import type { DocumentKind } from './handle-document.mjs'

/**
 * What a reader's teams look like at rest, and what this endpoint will accept.
 *
 * Strict on purpose, and deliberately the opposite of the browser's decoder for
 * the same shape. The browser reads leniently — a damaged member must not cost
 * the reader the rest of their teams. This refuses the whole document instead,
 * because the two are answering different questions: the browser is recovering
 * from something already stored, and this is deciding what may be stored at all.
 * A contract test runs one table of documents through both so they cannot drift.
 *
 * Every bound below is enforced here rather than in the interface, because this
 * endpoint is reachable by anyone holding a valid identity assertion — including
 * the reader's own compromised tab. A limit the browser enforces is a suggestion.
 */

/** Generous for a team, small enough that nobody stores a database in here. */
export const MAX_TEAMS = 50
export const MAX_MEMBERS = 200
export const MAX_NAME_LENGTH = 100

/**
 * The largest body this will read at all.
 *
 * A team of two hundred is roughly twelve kilobytes, so this is fivefold
 * headroom and still four orders of magnitude below what the store would take.
 * `Content-Length` is checked against it before the body is read, and the read
 * is capped again — a declared length is a claim, not a fact.
 */
export const MAX_BODY_BYTES = 64 * 1024

/**
 * A member is stored by the identifier the provider says cannot change, with
 * the username beside it as the address and the name as what the reader last
 * saw. `webUrl` is deliberately absent: it is derivable from the username and
 * the instance, and storing it would put a second source of truth for the host
 * inside the document.
 */
const memberSchema = z.object({
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  username: z.string().regex(/^[\w.-]{1,255}$/u),
})

const teamSchema = z.object({
  id: z.uuid(),
  members: z.array(memberSchema).max(MAX_MEMBERS),
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  updatedAt: z.iso.datetime(),
})

/**
 * `version` is a literal rather than a number, so a document written by a later
 * shape is refused here instead of being half-understood.
 */
const documentSchema = z
  .object({
    teams: z.array(teamSchema).max(MAX_TEAMS),
    version: z.literal(1),
  })
  .check((context) => {
    reportDuplicates(
      context.value.teams.map((team) => team.id),
      context,
      'two teams share an identifier',
    )

    for (const [index, team] of context.value.teams.entries()) {
      reportDuplicates(
        team.members.map((member) => member.id),
        context,
        `two members of team ${String(index)} share an identifier`,
      )
    }
  })

export type TeamsDocument = z.infer<typeof documentSchema>

/** An empty document, which is what a reader who has stored nothing has. */
export const EMPTY_DOCUMENT: TeamsDocument = { teams: [], version: 1 }

export type DocumentResult =
  { readonly document: TeamsDocument; readonly ok: true } | { readonly ok: false }

/**
 * The same, from the text the store or the wire carried.
 *
 * `JSON.parse` throwing is not exceptional here: the body is whatever somebody
 * posted, and a stored value can be truncated by a write nobody finished.
 */
export function parseDocument(text: string): DocumentResult {
  try {
    return readDocument(JSON.parse(text))
  } catch {
    return { ok: false }
  }
}

/**
 * Reads a document, refusing anything this endpoint would not have written.
 *
 * The failure carries no detail. What went wrong is diagnostics for whoever
 * sent it, and this endpoint answers an unauthenticated internet — a message
 * naming the field that failed is a free schema for someone probing it.
 */
export function readDocument(value: unknown): DocumentResult {
  const parsed = documentSchema.safeParse(value)

  return parsed.success ? { document: parsed.data, ok: true } : { ok: false }
}

/** Duplicate identifiers, reported onto whichever check is running. */
function reportDuplicates(
  identifiers: readonly string[],
  context: z.core.ParsePayload<TeamsDocument>,
  message: string,
): void {
  if (new Set(identifiers).size !== identifiers.length) {
    context.issues.push({ code: 'custom', input: identifiers, message })
  }
}
/**
 * The document kind the teams endpoint is built from.
 *
 * `suffix` names this document, exactly as the other one names itself. It was
 * empty for a while — teams were the first document stored and took the
 * reader's key unqualified — which left the teams key a *prefix* of the
 * preferences key: a `list({ prefix: `v1/${sub}` })` would have returned both,
 * counting the reader's teams as a container rather than a document. Nothing
 * lists by prefix — `DocumentStore` offers `read` and `write` and nothing
 * else — so it was a trap set and not sprung, and it is gone.
 *
 * **It is part of the address, and changing it moves nothing.** A deploy would
 * start reading a key that is not there, and a missing key is indistinguishable
 * from a reader who has never saved: no error, no null anybody sees, just an
 * empty list where a roster was. The same hazard as the region constant in
 * `blob-store.mts`, by the same mechanism. This one was changed only because
 * the store was being emptied in the same breath and nobody had stored anything
 * worth keeping; the next change has to copy first.
 */
export const TEAMS_DOCUMENT: DocumentKind = {
  empty: EMPTY_DOCUMENT,
  maxBytes: MAX_BODY_BYTES,
  parse: parseDocument,
  suffix: '/teams',
}
