## Context

See `proposal.md` — Why for the production evidence and the two defects. What
shapes the approach:

- `GraphQLClient.request` returns `Promise<unknown>`, so there is nowhere for
  "GitLab answered, partly" to be expressed. `dataOf` therefore has only two
  moves: return data, or throw.
- `query-client.ts` does not retry a failure whose kind is not `unavailable`, and
  the persisted cache is empty on a first visit. A `rejected` classification on a
  first load is therefore permanent until the reader reloads — which is what the
  affected reader is living with.
- `model/` is pure and carries the 100% coverage floor and the 85% mutation
  floor. `api/` is the adapter. i18n is prohibited in `model/`.
- `REPORT-3` already distinguishes a settled total from a floor, and retrieval
  continues until a period is settled. Anything new that means "this total is
  short" must not be routed through that flag, or it would drive an endless
  request loop.
- Timelog history is read newest-first with no period, one page per request, and
  the two requests this design adds are not atomic with each other.

## Goals / Non-Goals

**Goals:**

- A partly usable answer produces a usable report, and the fact that it was
  partial survives all the way to the screen.
- The hours inside a withheld entry are counted exactly once, or reported as
  missing. Never invented.
- The subtle part — reconciling two answers — sits in the layer that is mutation
  tested.
- A regression test at every level that the bug passed through unnoticed.

**Non-Goals:**

- Recovering the project itself. If GitLab will not resolve it for this reader,
  there is nothing to display; the entry is attributed to no project.
- Retrying the recovery request. One further request per affected page, then the
  remainder is reported as unread.
- Guessing an unread entry's date, duration or project from its neighbours.
- Changing how failures with no data at all are classified or presented
  (REPORT-9 stands).

## Decisions

### The client returns data and errors, instead of choosing between them

`GraphQLClient.request` returns `{ data: unknown; errors: readonly string[] }`.
`dataOf` throws `kind: 'rejected'` only when there is no usable data — the
payload has no `data` member, or it is `null`. Otherwise it returns both.

Alternatives considered:

- **Keep `Promise<unknown>` and let the gateway infer incompleteness from the
  null entries it sees.** Rejected: it works for this error and hides the worse
  one. An error that nulls `currentUser` itself leaves `data.currentUser: null`,
  which `toPage` already reads as "no report to show" — the reader would be told
  they logged no hours, as a fact, because of an error nobody passed on.
- **Log the errors.** Rejected: nothing in this app writes to the console, and an
  error the interface cannot see is an error nobody sees.

`data.currentUser === null` keeps its current meaning: a token GitLab accepted
with no person behind it, and an empty report.

### Withheld entries are counted from the null entries, not from the error text

The number of withheld entries is the number of `null` items in `nodes`. The
GraphQL `errors` array is used only to decide that the answer was partial, never
parsed.

Alternative considered: read `path: [..., 'nodes', 7, 'project']` to learn which
index and which field failed. Rejected — the message text and path shape are
GitLab's implementation detail, not a contract, and the null item is the same
fact expressed in the schema. A null item is also what breaks the parse today,
so it is the fact the fix has to handle anyway.

### The recovery request is a second static query, not the first one edited

A separate query document, identical to `MyTimelogs` minus the `project`
selection, sent with the same `first` and `after`. It is issued only for a page
whose answer contained at least one null entry.

Alternative considered: build the query string by removing the `project` block
from the primary document. Rejected: string surgery on a query is unreadable and
its failure mode is a syntactically valid query that asks for the wrong thing.
Two static documents cost a few duplicated lines and are each independently
readable.

### Two answers are reconciled by a bounded multiset difference, never by index

The obvious merge — take the recovery answer's entry at each index that was null
in the primary — is wrong, and wrong in the expensive direction. The two requests
are not atomic. On the newest page (`after: null`) a timelog logged between them
shifts every index by one, and the entry at the null index in the second answer
is then one the first answer already returned. That counts an entry twice and
inflates the reader's hours. Losing hours is a bug; inventing them makes every
figure on the screen untrustworthy.

Chosen instead: compare the two answers as multisets over a natural key —
the recorded instant, the duration, the work item reference and the summary.
For each key, take from the recovery answer only the surplus over what the
primary answer already returned, and take no more entries in total than the
number of null entries observed.

Why a multiset and not a set: two entries can legitimately be identical on every
readable field (same instant, same duration, same item, no summary). Comparing
counts handles that exactly, where comparing membership would silently drop the
second one.

Why the bound: it makes drift one-directional. If the page shifted under us, the
worst case is that an entry is not recovered — and the report then says one entry
could not be read. Duplication is arithmetically impossible.

This function is pure and lives in `entities/timelogs/model/`. "An entry whose
project could not be read still counts, and counts exactly once" is a rule about
the reader's hours, not about transport, and `model/` is the layer with the
mutation floor — which is where off-by-one arithmetic belongs, because a
coverage-only test walks straight past it. The gateway in `api/` makes the two
requests and calls it.

### An absent project is `null`, not a placeholder `ProjectRef`

`TimelogEntry.project` becomes `null | ProjectRef`.

Alternative considered: a sentinel `ProjectRef` with an empty `webUrl` and a
recognisable `fullPath`. Rejected: it would render as a link to nothing, it would
compare equal to a real project wherever `fullPath` is used as a rollup key, and
it would put a user-facing string inside `model/`, where strings are prohibited.
`null` makes the compiler name every consumer — `strict` plus
`noUncheckedIndexedAccess` turn a missed one into a build failure rather than a
blank figure.

Rollup and aggregate keys become `project?.fullPath ?? NO_PROJECT`, where
`NO_PROJECT` is a constant that is not a valid GitLab path, so it cannot collide
with a real one. The split by project groups those entries under `project: null`
and the screen supplies the label, keeping i18n out of `model/`.

### "Short" is a separate notion from "unsettled"

`TimelogPage` gains `withheld` and `recovered` counts; unread entries are
`withheld - recovered`, derived rather than stored twice. `HoursReport` exposes
the sums across loaded pages: how many entries were counted without a project,
and how many could not be read.

These do not touch the `settled` flag from REPORT-3. `settled` means "retrieval
has passed the start of this period" and it drives further page requests; an
unread entry is permanent, so routing it through `settled` would produce an
endless request loop over a page that will never improve. An unread entry also
has no date — the answer withheld it entirely — so it cannot be placed in a
period. Every period total the report presents is therefore reported as short
while any unread entry exists, which is the only honest reading available.

A page restored from the persisted cache has no `withheld` or `recovered` member.
Reading a missing count as zero is exactly right, and provably so: the code that
wrote those cached pages threw on a partial answer rather than persisting one, so
every persisted page is a complete one. No cache buster is needed.

### The tests that would have caught this, at every level it passed through

The bug shipped through a suite with 100% model coverage because every fixture in
`tests/support/gitlab-timelogs.ts` and `tests/e2e/support/` was shaped from a
recorded **successful** response. The response shape that breaks the app was
never in the suite, so nothing was there to fail. The fix therefore adds the
missing shape as a recorded fixture and asserts against it at each level:

1. `src/shared/api/graphql.test.ts` — a payload with `data` and `errors`
   together returns the data; a payload with `errors` and no data throws
   `rejected`. This is the assertion whose absence let the defect ship.
2. `src/entities/timelogs/api/` — the recorded partial payload parses; a null
   entry does not reject the page; the recovery request is issued exactly once
   and only for a page that withheld entries; an entry present in both answers
   is counted once.
3. `features/domain/` — the rules, citing REPORT-10 and REPORT-11, as
   `bun run arch:trace` requires.
4. `features/acceptance/` — the browser is served the recorded partial response
   and the dashboard shows hour figures rather than the refusal notice. This is
   the one that reproduces the reported symptom end to end, which is the level
   the report came from.

Two of these guard the class rather than the instance: a payload where **every**
entry is null (the worst case) must neither throw nor invent an entry, and any
payload carrying `data` must be used regardless of what `errors` holds. Stryker
covers the multiset arithmetic on the merge, where an off-by-one survives a
coverage-only test.

## Risks / Trade-offs

- **The two requests are not atomic; the page can shift between them** → the
  bounded multiset difference makes duplication impossible and turns drift into
  a reported unread entry.
- **One extra request per affected page** → issued only when a page withheld
  entries. Pages load on demand (REPORT-6), so a reader with a long history of
  dead projects pays one extra request per page they actually scroll to, not one
  per page of their history.
- **The recovery answer can itself be partial** → any entry still withheld is
  counted as unread and reported. No retry loop.
- **A permanently unreadable entry means every period reports as short, forever**
  → correct, and stated as a count of entries rather than as a loading state, so
  it does not drive pagination and does not read as a transient error.
- **`project` becoming nullable touches five screens and two model files** → the
  compiler enumerates them; there is no runtime path where a missed site renders
  blank.
- **Complexity ceilings (8 cyclomatic, 10 cognitive, 40 lines)** → the gateway's
  "recover or not" branch and the merge are separate functions; neither grows the
  existing `myTimelogs` body.

## Migration Plan

No data migration and no deployment sequencing: a static SPA, published by the
Netlify build, with the persisted cache backward compatible as argued above.
Rollback is a redeploy of the previous build.

The affected reader is the acceptance test for the deploy: her history contains
the withheld entries, so the dashboard either shows her hours or does not.
