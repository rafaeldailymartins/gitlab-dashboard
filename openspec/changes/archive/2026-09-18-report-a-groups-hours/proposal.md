## Why

A team lead has no way to see the hours of the people they lead. The dashboard
answers "how much did I log"; the question a lead arrives with is "who on my
squad did not log", and today the only answer is to ask each person. The team
this dashboard replaced Jira for had that screen — a Worklog Report of people
down, days across — and lost it.

The screen is worth building now because GitLab will answer it exactly.
`Group.timelogs` accepts `startTime`/`endTime` as instants rather than the UTC
calendar dates that forced the personal report to read history newest-first, and
`TimelogConnection.count`/`totalSpentTime` are computed before per-entry
authorization — so for the first time this app can state, to the second, how much
of the truth the provider refused to show the reader. That matters more here than
anywhere else in the app: a figure beside a colleague's name is one somebody makes
a decision about.

## What Changes

- A new screen at `/team`, addressable by URL, showing one calendar month of a
  GitLab group as a matrix: people down, days across, banded by ISO week, with a
  per-person total column and a per-day total row.
- Rows come from the group's **membership**, not from the timelogs, so a person
  who logged nothing still has a row. This is the answer the Jira report could
  not give, and it is the point of the screen.
- Every figure carries its own honesty. A month still being paged renders as
  reserved space, never as zero beside a name. A person whose entries the reader
  is not allowed to read shows their true total from GitLab's own aggregate
  alongside what is visible, rather than a silently short number.
- Hours are compared against a **stated** reference schedule shown on screen, not
  against the reader's own daily target. The app cannot know another person's
  contract, and a part-time colleague rendered as permanently short would be a
  claim it has no basis for.
- A `Days | Weeks` control changes the column axis. Weeks is the weekly subtotal
  the Jira report lacked and the layout that fits a phone; the table's structure
  and semantics are identical either way.
- Under/at/over the reference is carried by bar **length** against a marked
  reference rule, never by hue. The palette has one red and no green, and colour
  alone would fail WCAG 1.4.1.
- Group and month live in the URL search params, so a lead can send a colleague
  the exact view they are looking at.

Not in this change, and deliberately: no breakdown of _what_ a person worked on
(no project or issue axis), no charts, no CSV export, no per-cell drill-down, and
no holiday calendar — `read_api` exposes none. Each is a clean addition later on
top of what this change builds.

This change is additive. Nothing existing changes behaviour, so there is no
**BREAKING** item.

## Capabilities

### New Capabilities

- `group-timelog-report`: reading the hours logged inside a GitLab group over one
  calendar month, grouped per person and per day in the reader's time zone —
  including who has a row, how a month is asked for exactly, how a total states
  that it is a floor, and what the reader is told about hours the provider
  withheld from them.

### Modified Capabilities

None. The new screen inherits `dashboard-ui`'s cross-cutting requirements as
written: UI-8 (keyboard and WCAG AA in both themes), UI-9 (loading reserves its
space), UI-11 (usable at 375 px with wide elements scrolling in their own
bounds), UI-13 (a control to ask GitLab again), UI-14 (when the hours last
arrived) and UI-15 (a screen does not present figures as whole while it knows
they are short) all bind "every screen" or "a screen presenting hours" already.
Their scenarios are `Scenario Outline`s over a screen list, so covering `/team`
adds rows to their `Examples:` tables rather than changing a requirement.

`openspec/specs/dashboard-ui/spec.md`'s `## Purpose` says the screens are "built
for one person reading their own hours rather than for comparing a team". That
sentence stops being true and is edited directly in the merged spec — a delta
spec's Purpose is ignored for an existing capability, so it cannot be carried
here.

## Impact

**New slices.** `src/entities/group-timelogs/` (model, api, ui gateway provider)
and `src/pages/team-hours/`. The matrix lives in `pages/`, not `widgets/`: it has
exactly one consumer, and steiger's `insignificant-slice` fails a `widgets/` slice
that does not have more.

**GitLab.** Four new GraphQL documents, all routed through `Query.group(fullPath:)`
rather than root `Query.timelogs(groupId:)` — `GroupType` carries
`authorize :read_group`, so an unreadable group returns a clean null instead of
relying on a finder that performs no authorization check. No new OAuth scope:
`read_api` already covers all of it.

**Wiring.** A gateway in `src/app/lib/runtime.ts` built from the same GraphQL
client (one token renewal covers every gateway), a provider in `__root.tsx`, a
route file, and a fourth navigation link. The `<nav>` in
`src/app/routes/_authenticated.tsx` has no `flex-wrap`; a fourth pt-BR label
overflows the 375 px assertion that UI-11 runs on _every_ screen, so that one line
lands in the same change.

**Shared.** `shared/lib/date.ts` gains ISO-week helpers on the UTC-pinned
`TZDate`; `shared/lib/format.ts` gains a day-with-weekday style and memoises
`formatSpokenHours`, which today builds an `Intl.NumberFormat` per call while its
three neighbours are cached — a 25 × 31 grid calls it hundreds of times per
render. `toIsoDate` validates its time zone by constructing two more formatters
per call and is called once per entry. Both are pre-existing costs this screen
would be the first to feel; fixing them also speeds up the dashboard.

**Widget.** `widgets/hours-report`'s `SyncControl` is narrowed to a status plus a
list of notices so the group screen reuses the single `role="status"` region
instead of adding a second live region.

**Design tokens.** No new colour values. Two existing tokens take new roles and
need measured pairs added to `scripts/contrast/pairs.ts`. `--muted` is
specifically ruled out for the non-working column tint: against `--card` in the
dark theme it measures 1.12, under any floor worth stating.

**Dependencies.** One shadcn component (`combobox`, on the Base UI package already
installed) for the group picker, with its `VENDORED_UI_FILES` and coverage-exclude
entries. No new runtime dependency. Routes are code-split, so the 180 kB initial
budget is untouched provided the group gateway is not constructed eagerly from a
module the root imports.

**Process.** `openspec/config.yaml`'s context says "Single user, no team or group
aggregation" — left alone, it instructs every future planning prompt not to build
this. `scripts/check-traceability.ts` reads non-archived `openspec/changes`, so
`bun run verify` fails from the moment this change's delta spec exists until its
feature files cite every new requirement; the task order accounts for that.

**Known defect this change surfaces but does not fix.**
`src/entities/timelogs/api/gitlab-timelog-gateway.ts` computes `withheld` as the
count of null nodes, which cannot see an entry GitLab drops for authorization —
those leave no null and no error. The personal report can therefore under-report
its own shortfall. Naming it here so it is not mistaken for something this change
introduced.
