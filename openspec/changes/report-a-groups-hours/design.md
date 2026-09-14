## Context

See `proposal.md` — Why. What follows is only the state and the provider
behaviour that shape the approach.

Everything below about GitLab was read in `gitlab-org/gitlab@master` rather than
in its documentation, because the documentation does not say most of it:

- `Resolvers::TimelogResolver#parse_datetime_args` returns its arguments
  **untouched** when both `startTime` and `endTime` are given, and otherwise
  derives them with `start_date.beginning_of_day` / `end_date.end_of_day`. That
  derivation is the truncation `AGENTS.md` § "The timelog query carries no
  period" records. `startTime`/`endTime` are exact instants.
- `validate_args!` rejects `startTime` **with** `startDate`, but permits
  `startTime` with `endDate` — a pair that silently produces an exact start and a
  day-truncated end.
- `Timelogs::TimelogsFinder#by_group` performs no authorization check. Root
  `Query.timelogs(groupId:)` will therefore compute aggregates for a group the
  reader cannot read. `GroupType` carries `authorize :read_group`.
- `Timelog.in_group` joins projects on `group.self_and_descendants` — an inner
  join. Subgroups are included; a timelog whose `project_id` is null is excluded
  from the nodes **and** from the aggregates, so no arithmetic can detect it.
- `TimelogType` carries `authorize :read_issuable`. An entry the reader may not
  read is deleted from the node array by `keep_if` — no null, no error, no gap.
- `TimelogConnectionType#total_spent_time` and `CountableConnectionType#count`
  run in SQL over the full, unpaginated, **unredacted** relation. This asymmetry
  is the only instrument that can see the redaction above.
- `TimelogType#user` resolves through a `BatchModelLoader` with the Ghost user as
  its default, and `read_user` is enabled for any authenticated caller. A null
  node caused by an unresolvable `user` is not a reachable failure mode.
- `Timelog.project` is `Project!` while connection nodes are nullable, which is
  the mechanism behind the existing `MY_TIMELOGS_WITHOUT_PROJECT` recovery. This
  screen does not select `project`, so it never triggers it.
- `Gitlab::Graphql::Pagination::Keyset::Connection` computes `endCursor` and
  `hasNextPage` from the nodes **before** redaction. A page can legitimately
  return zero nodes with `hasNextPage: true`.

Constraints from this repository that shaped the design rather than decorated it:
`model/` is pure and held at 100% coverage and 85% mutation score; functions are
capped at 40 lines (60 for components) and 3 parameters; steiger fails a
`widgets/` slice with one consumer; axe runs with the `best-practice` tag set, so
`landmark-unique` and `empty-table-header` are live; `scripts/check-contrast.ts`
measures every declared pair in both themes.

## Goals / Non-Goals

**Goals**

- Every figure on screen provable by a domain test, and every figure that is
  short able to say by how much.
- The month exact in the reader's zone without depending on any one reading of
  the provider's date semantics.
- One `role="status"` region on the screen, shared with the existing widget.
- No new colour value, no new runtime dependency, no change to the initial bundle.

**Non-Goals**

- A reusable matrix component. It has one consumer; steiger's
  `insignificant-slice` and `AGENTS.md` both say that lives in `pages/`.
- Generalising `entities/timelogs` to cover both reports. The personal report
  reads an unbounded history newest-first under one cache key with no period; this
  one reads a bounded period oldest-first per group and month. Merging them would
  make both harder to reason about for no reuse worth having.
- Retrofitting the id-based reconciliation onto `entities/timelogs`. Its documents
  carry no `Timelog.id`; that is an obvious separate change.

## Decisions

### The month window is widened, and the month is cut locally

`from = ${addDays(startOfMonth(m), -1)}T00:00:00.000Z`,
`to = ${addDays(endOfMonth(m), +1)}T23:59:59.999Z`, then `entriesWithin` cuts the
month with `toIsoDate(spentAt, timeZone)` — the app's single instant-to-day
boundary.

`startTime` is exact, so the widening is not needed for correctness today. It is
kept for two reasons that outlive that fact. First, truncation in either direction
can only move a start earlier and an end later, so a widened window stays a
superset under every candidate semantics — the screen never depends on the
provider behaving one way, which is a stronger property than "we checked". Second,
the same cached answer stays correct when the reader changes time zone, because
the cut is local.

No IANA offset exceeds ±14 h, so one day of slack always suffices: the earliest
instant on the reader's first local day is `first−1 T10:00Z` at UTC+14, the latest
on their last is `last+1 T11:59:59.999Z` at UTC−12. Worked for
`America/Sao_Paulo` and `Asia/Tokyo` in the domain tests.

Both `startTime` and `endTime` are always sent and neither `startDate` nor
`endDate` ever is, built by one total function so the pair cannot drift.
`Group.timelogs` is `TimelogConnection!` under a nullable `Group`, so an inverted
window would raise an argument error that nulls the entire `group` and destroys
every sibling field — `readerWindow` is total and always produces `from < to`, and
a domain test pins it.

_Alternative rejected:_ asking for the exact month and trusting `startTime`. One
GitLab release away from being wrong, with no test that would notice.

### `count` / `totalSpentTime` are the shortfall instrument, probed once and per person

Three documents rather than one:

1. `GROUP_HOURS_PAGE` — the entries, paged. Selects no `count` and no
   `totalSpentTime`: those run a `COUNT` and a `SUM` over the whole window and
   would be recomputed on every one of up to thirty page requests.
2. `GROUP_MONTH_PROBE` — one request, `first: 1`, carrying the group's name and
   `maxAccessLevel`, the window's `count` and `totalSpentTime`, and one
   `timelogs(username: …)` alias per person carrying theirs. Each alias costs 7
   of the 250 complexity ceiling, so batches are capped at 32 aliases and a group
   of any realistic size fits in one or two requests.
3. `GROUP_ROSTER` — `groupMembers(relations: [DIRECT, DESCENDANTS])`, paged to
   exhaustion inside the gateway rather than exposed as an infinite query. The
   default relation set is `[DIRECT, INHERITED]`, which hands a squad lead
   everyone who inherited access from the top of the company.

The per-person alias is what makes GROUP-9 possible at all. Without it a shortfall
can only be stated for the group, on a screen whose entire purpose is comparing
one person with another — which is the shape that makes a lead misjudge somebody.

The residual is reported **signed**, not clamped:
`declared − visible`. A clamp at zero would turn "the figures are too high by four
hours, because a correction was withheld" into "nothing is missing", which is the
one direction that cannot be recovered by looking harder. The two page requests
are not atomic, so a small residual of either sign is expected during paging; the
report only states a shortfall once the period is complete, and states the
direction when it does.

`totalSpentTime` is a `BigInt` serialised as a **string**. It is coerced at the
zod boundary.

Honest consequence, recorded on screen: the aggregates describe the **widened**
window, so a shortfall can over-declare by whatever was withheld on the two
padding days. Over-declaring is the safe direction.

_Alternative rejected:_ counting null nodes, as the personal gateway does. It
cannot see a redacted entry, which is the common case here.

### There is no recovery document

An earlier draft carried a second document omitting `user`, mirroring
`MY_TIMELOGS_WITHOUT_PROJECT`. It is dead code: `TimelogType#user` falls back to
the Ghost user and `read_user` is enabled for any authenticated caller, so a node
nulled by an unresolvable `user` is unreachable, and the model would carry a
permanent `person: null` branch that no real answer can produce. The aggregate
delta already covers every way an entry can go missing, including the two this
recovery could not.

`person` is therefore non-nullable, and `GROUP_HOURS_PAGE` selects `Timelog.id`
only so a future recovery could be an exact set difference rather than the bounded
multiset difference `entities/timelogs` needs.

### The grid carries a `pending` state, driven by how far the read has got

`GridRequest` carries `loadedThrough: IsoDate | null` — the day before the last
entry read while the period is incomplete, and the period's end once complete.
Every cell after it is `pending` and renders as reserved space. Cells are
`logged | unlogged | non-working | future | pending`, resolved in that precedence
with a test on each side of the `today` and `loadedThrough` boundaries so the
`>` → `>=` mutants die.

This is what GROUP-7 buys. `sort: SPENT_AT_ASC` fills the matrix left to right, so
without it a forty-person month renders "logged nothing" beside real names for the
twenty to thirty seconds it takes to page — a specific, confident, false claim
about a named colleague, rendered 1200 times, while the correction is a line of
small type in the corner. Per-person totals are reserved space for the same
reason; only the group aggregate is shown early, marked as a floor.

_Alternative rejected:_ a whole-table skeleton until complete. It throws away
determinate progress the provider is handing us for free — `count` tells the
reader exactly how far the read has got.

### The reference is a stated constant, not the reader's own target

Eight hours Monday to Friday, zero at the weekend, named in the legend. It drives
both the bar length and which columns count as "nothing expected".

Applying the reader's own `dailyTarget` to colleagues was rejected: it renders a
part-time teammate's every cell as a visibly short bar, which is an assertion about
another person's contract that this app has no basis for, and the bar is the
pre-attentive channel a lead reads before any digit. A constant is at least
constant, and it is on screen.

Over the reference is drawn as the bar crossing a dashed reference rule at the
100% mark — shape, in the vocabulary `DayBar` already uses. A brass cap on a
clamped bar was rejected: `charts.css` records that brass against brick measures
ΔE 4.4 under deutan, so the two states would be identical for exactly the readers
WCAG 1.4.1 is about.

_Open to revisit:_ a four-day-week team sees Fridays marked as unlogged working
days. Making the reference configurable is a clean later addition; guessing at it
now is not.

### The matrix is a native `<table>`

`scope`-correct row and column headers give NVDA, JAWS and VoiceOver
two-dimensional navigation that announces the person and the day on every move,
with no JavaScript. `role="grid"` would put screen readers into application mode
and remove those very keys, and its roving tabindex plus the APG key set cannot be
written under this repo's complexity ceilings without fragmenting into four files
— each one a place a tabindex bug hides, which is the failure `docs/qa` already
records once.

Because the headers announce the person and the day, the cell text must **not**
repeat them, or every row is read with the name thirty-one times. No data cell is
a tab stop.

Two structural traps, both real:

- `overflow-x: auto` makes the container a scroll container on both axes, so
  `position: sticky` inside it sticks to the container. The container owns both
  axes deliberately, gets `tabindex="0"` (axe `scrollable-region-focusable`) and a
  visible focus ring (the keyboard walk reads the computed style at every stop).
- `border-collapse: collapse` drops borders on sticky cells. The table uses
  `border-separate` with `border-spacing: 0` and explicit `<col>` widths, which
  also satisfies UI-9 — with `auto` layout the columns re-measure as figures
  arrive and the whole grid jitters.

The scroll container is the **only** named region. An earlier draft nested it
inside a named `<section>` with the same `aria-labelledby`; a named `<section>` is
a `region` landmark, and two with the same name fail axe's `landmark-unique`,
which this suite runs.

### Tokens: `--chart-empty`, never `--muted`

The non-working column tint is `--chart-empty` composited over `--card`. `--muted`
was measured against `--card` in the dark theme at 1.12 and rejected. The tint goes
on the cell rather than the `<col>`, because a row hover paints above a column
background in the CSS table layer order and would erase the tint on the row the
reader is pointing at.

Two pairs are added to `scripts/contrast/pairs.ts` and must be measured, not
assumed.

### Caching

`groupHoursQuery` is an infinite query keyed
`['group-timelogs', fullPath, month]`, paging on `pageInfo.hasNextPage` **and
nothing else** — never on an empty page, never on a short page. `gcTime` 30
minutes; `refetchOnWindowFocus: false`, which the shared query client leaves at
its default: for an infinite query, a focus refetch re-runs every page, so
alt-tabbing back would re-page a whole month.

`shouldDehydrateQuery` excludes these keys from the persister. That is GROUP-18,
and it is also the only thing keeping a month of a team's hours out of IndexedDB
on a shared machine.

## Risks / Trade-offs

- **A shortfall figure that is itself wrong would be worse than no shortfall
  figure.** → The three-way identity (`declared = visible + shortfall`) is a domain
  test, asserted in seconds, on both signs of the residual; the screen states the
  shortfall only once the period is complete.
- **`startTime` semantics change in a future GitLab release.** → The widened
  window is a superset under every candidate semantics, and a domain test pins the
  widening rather than the provider.
- **A forty-person month is ~30 sequential requests and 1240 cells.** → Rows are
  memoised and carry `content-visibility: auto` (the utility the day feed already
  uses); `formatSpokenHours` and `toIsoDate`'s zone validation are memoised before
  the screen is built, since both construct an `Intl` formatter per call today.
- **A single transient error nulls the whole `group` and discards the load.** →
  Only recognisable authorization and argument errors classify as `rejected`,
  which the query client does not retry; anything else is `unavailable`, which it
  retries. The repo has been burned once by over-classifying as `rejected`.
- **Adding a fourth navigation link overflows 375 px on every existing screen.** →
  `flex-wrap` on the `<nav>` in the same change, and the 375 px outline re-run for
  all screens, not just the new one.
- **`bun run verify` fails from the moment the delta spec exists** until every new
  requirement is cited, because `check-traceability.ts` reads non-archived
  `openspec/changes`. → Feature files are their own task group and the change is
  not merged until the gate passes; this is what the repo did for
  `recover-partial-timelog-responses`.
- **Time logged on a work item with no project is invisible and undetectable** —
  it is excluded from the nodes and from the aggregates alike. → Stated in the
  table's caption and in the scope line, per GROUP-1. There is no arithmetic
  remedy.
- **Screen-reader support for a spanning column header is uneven.** → The week band
  is a `<th scope="colgroup">` over real `<colgroup>` elements, and the week is
  also folded into each day header's spoken text, so the band is an enhancement
  rather than the only carrier. A manual step in `docs/qa/accessibility-audit.md`
  verifies it is not misattributed.
