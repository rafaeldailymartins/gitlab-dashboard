## Context

The team screen was built around `Query.group(fullPath:) { timelogs }` because
`GroupType` carries `authorize :read_group`, so a group the reader may not open
comes back as a clean `null` instead of relying on a finder that performs no
authorization of its own. That decision was right and is not what is being
undone. What is being undone is the assumption underneath it: that the unit a
lead reports on is a namespace.

Two facts settled before any of this was designed, both read out of GitLab's own
source rather than inferred.

**A `User` parent is a door, and the root field is not.**
`Resolvers::TimelogResolver#validate_args!` permits a non-admin when
`has_parent?(object, args) || for_current_user?(args) || admin_user?`, and
`has_parent?` is `object || args[:group_id] || args[:project_id]`. It tests
`object` generally rather than testing for a Group or a Project, so a `User`
parent satisfies it and the "current username only" rule — which constrains the
root `Query.timelogs` — never runs. `UserInterface.timelogs` declares
`complexity: 5` with no field-level `authorize:`; `UserPolicy` enables
`read_user` for anyone not anonymous; `TimelogsFinder` builds
`parent&.timelogs || Timelog.all`, and `User has_many :timelogs` with no
namespace scoping at all. No EE override of either the resolver or the finder
exists.

**The window and the filter are both free.** `parse_datetime_args` has no
parent-specific branching, and `times_provided?` returns `args` untouched when
`startTime` and `endTime` are both given — so GROUP-2's widen-by-one-UTC-day and
cut-locally discipline is unchanged and unconditional under the new parent.
`TimelogsFinder#execute` composes its filters as sequential ANDs and `by_group`
returns the relation unchanged when no `group_id` is given, so an empty filter
genuinely reaches work items belonging to no project, and a set one narrows
through `in_group`. Neither end of GROUP-1's two states costs anything to build.

**What the provider actually answered.** Task group 1 was run read-only against
the real instance, with `queryComplexity { score limit }` embedded in each
document so the score is read rather than inferred. Sixteen people, the real
Squad Fiscal roster, over September widened a day at each end.

| Measured                                        | Result        |
| ----------------------------------------------- | ------------- |
| Complexity, one person                          | **26** of 250 |
| Complexity, sixteen people                      | **29** of 250 |
| Wall clock, sixteen people, cold                | ~5.5 s        |
| Wall clock, sixteen people, warm                | ~2.5 s        |
| Wall clock, split into concurrent chunks        | ~2.0 s        |
| Declared hours, unscoped                        | **1325.7 h**  |
| Declared hours, scoped to the squad's own group | **269.2 h**   |

Four things follow, and three of them simplify the design.

**Complexity does not move with roster size.** Twenty-six points for one person
and twenty-nine for sixteen is about a fifth of a point each — the additive model
holds, and a hundred people would score in the forties. The batch size is bounded
by the connection's own hundred-node page cap and by nothing else. There is no
complexity-driven batching constant to tune.

**Chunking does not pay.** Splitting sixteen people across concurrent requests
saves about half a second against one request for all of them, and the first
measurement of 5.5 s was a cold cache rather than a ceiling. One request for the
team it is.

**The group filter narrows by a factor of five, on real data.** The same sixteen
people logged 1325.7 hours in that window, and 269.2 of them inside the group the
squad is named after. Four fifths of this team's time is logged somewhere else —
which is the complaint this change exists to answer, measured rather than
asserted, and the reason the filter's default has to be "no filter".

**Three different scalar types, and getting one wrong is an error rather than a
silent wrong answer.** `users(ids:)` takes `[ID!]`, `user(id:)` takes `UserID!`,
and `timelogs(groupId:)` takes `GroupID` — not `ID`, which is what the first
draft of every one of these documents used and what the provider refused.

Two observations that were not asked for and that change what the report has to
handle. One person logged 132 entries in that window, so the continuation
document is exercised by the real data rather than kept for a hypothetical. And
of the fifteen people whose month fitted one page, **none** had a declared count
above what was shown: this reader sees everything, and the withheld machinery has
no work to do on this squad today. It stays, because it is about what the
provider may withhold from some reader rather than what it withheld from this
one — but the column probe's economics are far less pressing than the unscoped
default suggested they would be.

## Goals / Non-Goals

**Goals.** A lead reports on the people they chose, wherever those people logged.
Every figure keeps saying how much of itself the reader may inspect. The screen
gets faster as a consequence of the shape rather than as a separate exercise. A
team survives a change of device.

**Non-Goals.** Sharing a team between readers — the stored shape carries a
per-team identifier so it can be added later without a migration, and nothing
else about this change anticipates it. Any breakdown of _what_ a person worked
on. Any export. Reading hours through a server: every hour still travels browser
to GitLab on the reader's own token, and the one function this change adds never
sees one.

## Decisions

### The whole team is one field, not one alias per person

`users(ids: [...]) { nodes { id username name webUrl timelogs(...) { count totalSpentTime pageInfo nodes } } }`
scores **26** of GitLab's 250-point budget for one person and **29** for sixteen,
measured. Complexity counts fields in the document rather than rows in the
answer, so the roster is nearly free: about a fifth of a point each.

The repo had already measured the same effect for the shape this replaces —
`documents.ts` records 7 points per `timelogs { count totalSpentTime }` alias,
which is 5 + 1 + 1 — and the new measurements confirm that arithmetic survives
the change of parent exactly. A day column still costs 7 under a `User`.

The aggregates ride on that first round rather than in a separate probe. That is
a correctness gain and not only a saving: a connection's aggregate and its nodes
are the same relation under the same range, so read in one field they cannot
disagree. The group report read them seconds apart in a second request and
documented a residual of either sign while paging because of it.

_Alternative rejected:_ one aliased `user(username:)` per person. It costs 14
points each, so sixteen people fill the budget and a seventeenth needs a second
request — the roster size becomes a complexity problem again, which is exactly
what the `users()` connection removes.

### Continuation is a second document, and it omits the aggregates

A per-node cursor cannot travel back through `users(...)`: each node's connection
has its own cursor space and the parent field has no argument that reaches into
it. So whoever comes back with `hasNextPage` is asked again through aliased
`Query.user(id:)`.

This is the one document whose size **is** bounded by complexity, and the bound
is measured rather than estimated: one alias scores 17, eight score 115 and
sixteen score 227, which is 14 a head. Twenty-four score 339 and are refused. So
the batch is **sixteen** — seventeen would fit at 241 and leave nine points of
room, which is not enough to absorb a field somebody adds later.

It is not a hypothetical path. In the measured month one person logged 132
entries, so the real data already overflows a hundred-entry page.

### A month of day columns fits, and forty does not

The column probe is the other document bounded by complexity, and it is bounded
tightly. One column scores 19, thirty-one score **229**, and forty score 292 and
are refused — 7 a column, which is the same figure `documents.ts` records for the
shape under a `Group`. A thirty-one-day month plus the period check therefore
fits with twenty-one points to spare, and nothing wider than a month ever needs
asking.

That margin is the reason this document asks about **one person at a time**. A
whole grid would be columns times people and is refused long before it reaches a
database.

That document asks for no `count` and no `totalSpentTime`. They are window-wide,
not page-wide, so re-asking returns the same number while re-running a `COUNT`
and a `SUM` over every member's whole month; and an aggregate read at a later
instant than the page it is compared against can disagree for reasons that are
not redaction. In practice the round never fires — a person logging under a
hundred entries in a month fits the first page.

### `hasNextPage` is the only thing that ends a read

A page can carry zero nodes and still have `hasNextPage: true` and a usable
cursor: `has_next_page` is computed before redaction, and GitLab patched
`end_cursor` to read the pre-redaction node list precisely because a fully
redacted page has no node to take a cursor from. The existing gateway already
derives its cursor from `hasNextPage` alone and says why; that stays.

### The group filter is threaded through every user document or through none

The pages, the per-person aggregate and the per-column probe must all carry the
same `groupId`, and it must join all three query keys. An instrument measuring a
different set than the figures makes every shortfall on the screen nonsense —
and it would do so silently, because both numbers would look reasonable.

There is a free check in this: with the filter set to a group the reader can read
in full, the shortfall should be zero. The scoped state is a consistency test on
the unscoped one.

_Alternative rejected:_ scoping only the pages and leaving the aggregate
unscoped, to keep the "true total" while narrowing the cells. It would report the
whole of a person's work outside the group as withheld from the reader, which is
the same class of bug as the one GROUP-9's widened-window paragraph exists to
prevent.

### The filter is in the address and is not remembered

It changes every figure and nothing about how the screen looks, so a link that
dropped it would send a report that is not the one being looked at.

It is not remembered, and the asymmetry with the team is the point. The team has
no safe default — something must be chosen — so remembering saves a choice the
reader is forced to make anyway. The filter's default is the widest and most
honest state, and remembering a narrowing would make every later visit show less
than the screen's own reach sentence prepares the reader for, silently, in the
one direction that understates a colleague's month. The cost is named rather than
hidden: a lead who always scopes to one group re-picks it each visit.

_Alternative rejected:_ remembering it beside the team. Symmetrical, convenient,
and it makes the reader's own past click the reason a figure is low.

### This is not the two-picker control that was built and reverted

`AGENTS.md` records a second control, naming a wider group to read and a narrower
one to draw, that was built and reverted because "two group pickers on one screen
is a price the answer did not justify". That pair was two pickers over the same
vocabulary, answering overlapping questions, each defaulting to the other. This
pair is not two of anything: one names **people**, from a list the reader wrote;
the other names **how much of those people's work counts**, and its default is
all of it, which it says on itself. Exactly one of them has a correct default,
which is the property the reverted pair lacked and the reason it could not be
read off the screen.

### A roster is stored by identifier and addressed by it too

GitLab releases a username when an account is renamed and another account may
claim it, so a roster matched on username alone can come to point at a different
person with nothing on screen to say so. The identifier is who was meant; the
username is how the provider is addressed.

Task 1.2 settled how it is asked for. `users(ids: [ID!])` resolves, returns
`username`, and agrees with `users(usernames:)` exactly on `count` and
`totalSpentTime`; `user(id: UserID!)` does the same for the continuation and the
column probe. So the identifier is not merely stored and checked — it is what the
provider is asked with, end to end, and the username is carried only as the label
the reader last saw. That removes the rename hazard at its source rather than
detecting it downstream, which is the difference between a class of bug being
impossible and a class of bug being reported.

Matching is still never positional: `users()` promises no order and returns fewer
nodes than it was asked identifiers when one resolves to nothing, and diffing the
two sets is the only way to learn which. A member the provider will not resolve
draws no figures at all, because an absent answer is not an answer of zero.

_Alternative rejected:_ storing and asking by username, with the identifier kept
to detect drift. It works, and it makes every row's correctness depend on a check
somebody could later simplify away.

### Withheld hours are placed only on a narrowed report

The column probe asks the same aggregate one day at a time, and it is the only
instrument that can say which day a withheld hour belonged to — the entry itself
is spliced out of the answer with no id and no `spentAt`. It costs one request
per short row, capped at six, because a month of column aliases is 7 points of
the 250-point complexity budget each and a whole grid is refused before it
reaches a database.

That cap was chosen when this screen read one group. A short row there was
unusual — a Guest, mostly — and six requests located an anomaly.

Reading a team's whole reach inverts the economics. A reader now sees every
colleague's working life through their own permissions, so almost every row is
short, and usually by a lot. Six rows of twenty getting day-level marks while the
rest keep the note is a difference on screen that corresponds to nothing about
the data: which six is decided by an identifier the reader never sees. Raising
the cap does not fix it — the cost is the provider's database, one request per
row, on every report, to locate something that is the ordinary condition rather
than a surprise.

So the placement runs only when the report is narrowed to a group. There the
shortfall means something again: the reader chose a group they can mostly open,
and a row short _in it_ is worth locating. Unnarrowed, the row still says hours
are missing and does not say where — which is exactly what it already says when
a placement fails its checks, so the screen grows no new state and the reader
learns no new vocabulary.

### What a figure means is the model's; what may be said about it is the screen's

The two-state claim — "no hours logged anywhere" against "no hours in this
group" — is resolved in `pages/team-hours/ui/day-cell.tsx`, not in
`entities/team-timelogs/model/`, and that placement was a decision rather than
convenience.

The model measures. Under either reach a working day nobody logged in is the
same kind of cell: `unlogged`. What changes is not the measurement but the
strength of the sentence the measurement will support, and that is a fact about
what the reader was told the figures cover — the caption, the scope line, the
key — rather than about the entries. Handing the grid a `scoped` flag would make
the model hold a fact it never uses in any arithmetic, and would put the one
decision on this screen that is purely about language in the one layer that is
forbidden to know any.

The consequence is that the claim is tested where it is made: the cell
component, the page, and two acceptance scenarios per reach — one of which keeps
the original prohibition verbatim, because the original reason for it still holds
whenever a group is named.

### Completeness is per person, and the read frontier disappears

Each person's month is a connection of its own, read `SPENT_AT_ASC`, so the
frontier argument — the newest read day is not settled, because the next page can
still carry more entries for it — applies per connection. A person whose month
fit one page is complete on the first response.

That removes the screen's worst behaviour rather than merely improving it. The
global frontier existed only because there was one connection; with one per
person, a twelve-person team no longer holds every row at `pending` behind its
slowest read.

### Suggestions are whoever logged, not whoever is a member

`groupMembers` is an access-control list: it includes people who never touched
time tracking and excludes people who logged time without membership. A lead
building a report wants the second set.

The window is a trailing ninety days of exact instants — not a month, so no day
boundary is involved and none of the widening, the local cut or `toIsoDate`
applies. `/teams` has no month control and should not grow one: the question is
"who has been working here lately", and a single month misses anybody on leave.
Paging is capped at ten pages with `SPENT_AT_DESC`, deduped by user identifier,
because distinct people saturate long before entries do — a busy group's ninety
days is thousands of timelogs and perhaps forty names, and exhausting it would be
hundreds of requests to learn forty of them. Where the cap is hit the screen says
the list may be incomplete; the individual search is the escape hatch and always
finds anybody the window missed.

Bots are dropped because nobody manages a bot's timesheet. Accounts that are no
longer active are **kept** — the old rule dropped them from a membership list,
where they were clutter; here an inactive account that logged time is somebody
who did the work and has since been blocked or left, which is the opposite of
clutter.

_Alternative rejected:_ keeping `groupMembers` as a second suggestion source
alongside this one, marked by provenance. More informative, and one more screen
and one more request in a flow whose whole job is to get out of the way.

### The identity assertion is minted, not held

GitLab's `id_token` lives **120 seconds**, while the access token lives two
hours. So it cannot be obtained at sign-in and kept.

Measured, not assumed. An assertion issued by gitlab.com on 2026-09-19 carried
`iat 1789778847` and `exp 1789778967` — 120 seconds exactly, matching
`Settings.oidc_provider['openid_id_token_expire_in_seconds']`, which only an
instance administrator can alter. That is what justifies `MAX_AGE_SECONDS = 150`
in `netlify/lib/identity.mts`: the lifetime plus the thirty seconds of clock
tolerance the verifier already allows, and no more.

The same token settled the claim underneath this one. Its `auth_time` was **289
seconds before its `iat`**, so it was minted on a refresh grant rather than at
sign-in — which until then was read out of doorkeeper's source rather than
observed.

It does not have to be. `doorkeeper-openid_connect@1.9.0` — the version GitLab's
`Gemfile.lock` pins — merges an `id_token` into every token response whose token
carries `openid`, and `RefreshTokenRequest#granted_scopes` carries the scope
forward, so the refresh grant re-mints one. The assertion is therefore obtained
on demand through the **existing** single-flight renewal, which is what stops a
second consumer quietly breaking the one-renewal-per-burst invariant that exists
because GitLab rotates the refresh token on every use.

This is also why there is no session cookie and no new secret: there is nothing
to sign, and the function reads the same two `VITE_` variables the bundle is
built with.

_Alternative rejected:_ exchanging the assertion once for a signed session
cookie. It needs a new secret, and it makes the endpoint cookie-authenticated —
which is what would make it CSRF-reachable. Authenticating from the
`Authorization` header and emitting no CORS headers at all means a cross-site
form cannot set the header and a cross-site `fetch` cannot pass the preflight.

_Alternative rejected:_ forwarding the GitLab access token and resolving it with
`GET /api/v4/user`. GitLab access tokens are opaque and carry no audience, so
without a mandatory check that the token was issued for this application, any
other OAuth app's token for the same user is accepted — a textbook confused
deputy. It also hands the function a credential that reads all of GitLab.

### No nonce, as a decision rather than an omission

GitLab accepts one, but the refresh path constructs its `IdToken` with no nonce,
so a verifier that required one would reject every refreshed assertion — and
refreshed assertions are the normal case here. The assertion arrives on the back
channel in the answer to a code obtained with PKCE and `state`, and OIDC Core
makes nonce checking conditional on having sent one. Threading a third
single-use value through the pending-authorization store closes nothing PKCE and
`state` leave open.

### The browser does not verify the signature, and the function does

The assertion reaches the browser over TLS in the answer to a request that
browser made; there is no adversary between those two points that a check there
would catch. What the browser needs is only "when do I ask for another", which is
`exp`. The check that matters happens where the assertion is used as a
credential — against GitLab's published keys, pinning `RS256` by `kid`, with
`iss` exact, `aud` the application's own id, and `iat` bounded independently of
whatever `exp` claims.

The discovery document's `jwks_uri` is refused if its origin differs from the
configured GitLab origin: that document decides where signatures are trusted
from, so a document naming somewhere else would mean whoever answers for that
origin can mint identities here.

### The storage key is derived, never named

The key is the verified subject, and the endpoint's address carries no identifier
at all. Addressing another reader's teams is therefore not expressible rather
than merely refused, which is a property that survives somebody later simplifying
a validation away. It also means the access log contains no user identifier,
because there is nothing in the path to log.

GitLab's `openid` scope puts a `groups_direct` claim — every group the reader
directly belongs to, as full paths — into the assertion, so it is more sensitive
than its subject alone and can be several kilobytes.

A real assertion from gitlab.com turned out to be wider than that. Beside
`groups_direct` it carried `name`, `nickname`, `preferred_username`,
`given_name`, `family_name`, `profile`, `picture`, `sub_legacy` and `auth_time`
— a small identity document rather than a subject and a list of paths, and one
that names the reader to anybody holding it. The verifier's return type is the
subject and nothing else, and `no-console` is an ESLint error with no file
restriction, so the function cannot log any of it.

### A write is conditional, and a failed one is not kept

Writes carry the version the writer last read, and one made against an older
version is refused with the current version returned beside it. Last-write-wins
over a whole roster silently drops a colleague off it.

A write that did not land is not recorded on the device and not queued for later.
A queued write is a write whose ordering nobody can see, replayed against a
document another device may already have changed — which reintroduces exactly the
clobber the version check exists to prevent, asynchronously, where it is hardest
to reason about.

### The device keeps no roster, and this was reversed on evidence

The first draft of this design cached the roster in `localStorage` so the team
picker would paint before the store answered, reasoning that GROUP-18 is about
hours and that GROUP-20 already persists a group path on the same distinction.

That reasoning is wrong, and the repository says so in a way prose cannot argue
with. `tests/e2e/steps/team.ts` asserts
`expect(stored.storage).not.toContain(BRUNO.name)`, and `BRUNO` is a **roster
member**, not an hours figure. So this codebase's executable reading of GROUP-18
is the broader one: another person's name does not reach the device. A cached
roster would have failed that scenario the moment a saved team contained the
fixture person — and shipping it would have meant weakening a security gate to
accommodate a design, which is the opposite of what a failing gate is for.

So there is no device cache. Teams live in the store and in the in-memory query
cache, and the teams query carries `meta: { persist: false }` exactly as every
group query does — otherwise `shouldDehydrateQuery` writes colleagues' names into
IndexedDB through the persister, which is the same leak by a quieter route.

The cost is a team picker that is empty until the function answers, and it is
small: this screen fetches before it draws anything else, so the cache would have
painted half of it from disk and left the other half waiting.

_Alternative rejected, for now:_ caching team **names and identifiers** only —
the reader's own labels, which name nobody. It is provably inside the assertion
and would make the picker instant. It is not in this change because the
cold-start cost it removes has not been felt yet, and a second storage tier is
easier to add once than to remove.

### The capability is renamed at archive, not in the delta

OpenSpec forbids renaming a capability inside a delta, and its scenario names are
identifiers a MODIFIED block may not drop. So the delta is written under
`group-timelog-report` with its existing scenario names, and the archive step
does the rename mechanically: `git mv` the spec directory, retitle it, rename the
four scenario headings whose wording is now wrong, and substitute the citation
prefix in the feature files. None of it is load-bearing —
`scripts/check-traceability.ts` matches the capability as `\S+` and never
validates it — which is why it is safe to do in one pass at the end rather than
piecemeal.

The requirement ids stay `GROUP-n`. They are what the traceability script pulls,
and keeping them is what lets a reader follow one requirement through two shapes
in `git log`. Renumbering to `TEAM-n` would read tidier for about a week.

### The screen is at `/teams`, and there is no fifth navigation link

A screen is swept by axe in both themes and asserted at 375 px forever, for the
cost of four lines, because the sweeps are addressed by URL. A modal costs a new
step definition, a new entry point for axe, and a sweep that silently stops
covering it the day somebody changes how it opens. There is also no dialog
component in `shared/ui`, and adding one vendors Base UI's focus-trap and
floating machinery into a second chunk beside the forty kilobytes the combobox
already costs.

No fifth navigation link: at 375 px in pt-BR the nav would read "Painel ·
Insights · Equipe · Equipes · Configurações", and two adjacent labels one letter
apart is a worse discoverability problem than one extra click.

_Alternative rejected:_ a modal over the report, so "add Camila and look again"
is one flow. Adding a person triggers a whole new per-person read anyway, so the
report is not live-editable in any meaningful sense, and the sweep cost is
recurring where two navigations are a one-off.

### The team picker is a select, and the group picker is shared

Three teams do not need a search popup. `SelectField` is already authored, tested
and used by two other fields, and using it keeps Base UI's popup off the route
every reader of the report loads.

The group picker now has two consumers — seeding a team and filtering a report —
which is what steiger's `insignificant-slice` rule wants and what a one-consumer
`features/` slice would have failed. It takes its label, placeholder and
empty-state as props so that neither screen's wording can drift into the other's,
and a `clearable` flag for the filter's "all groups" state, which the seed picker
does not have.

## Risks / Trade-offs

**~~`Query.users` may take graphql-ruby's connection default~~** → **measured and
closed.** Twenty-six points for one person, twenty-nine for sixteen, against a
limit of 250. The additive model holds and the roster size is not a complexity
problem at any size the page cap permits.

**~~Runtime is the unmeasured cost~~** → **measured, and smaller than feared.**
Sixteen people warm is about two and a half seconds, and splitting the request
concurrently recovers half of one. The chunking mitigation is not worth its
constant. What remains true is that this is linear in roster size, so a team
several times larger would be worth re-measuring rather than assuming.

**The unscoped report discloses more than the group report did** → a row total
now includes hours on work the reader cannot open, anywhere the provider counts,
including a colleague's personal projects. This is the change's deliberate trade
and it reverses a decision `AGENTS.md` records as settled, so that entry is
rewritten with its new reason rather than deleted. The mitigations are that the
figure is a volume and never a location, that the screen states its reach where
the figures are read, and that the filter narrows it for anyone who wants it
narrowed.

**Every row _may_ be short in the unscoped state** — though on the one squad
measured, none was: of the fifteen people whose month fitted a page, every
declared count equalled what was shown. So this is a risk about some other
reader, or some other group, rather than an observed cost. It still shapes the
design, because a reader who sees less is exactly the reader this instrument is
for → the column probe's economics
invert. Its `PLACEMENT_LIMIT = 6` was justified by shortfall being rare, and with
no filter almost nobody's visible hours will match their declared ones. Which six
rows get placement would be arbitrary, and each probe is thirty-one aliased
spans over an unscoped relation. Handled by task 7.6: the placement runs only
where the reach makes it meaningful, and the row reports its residue otherwise.

**A new top-level directory is invisible to four gates** → `tsconfig.json`,
`knip.config.ts` and `dependency-cruiser` all scope to `src`, and CI never
bundles the function at all, so a missing dependency or an unresolvable specifier
fails the Netlify deploy rather than the pipeline. Mitigated by widening the
three configs and by writing sibling imports with explicit extensions.

**The acceptance suite cannot exercise the function** → `playwright.config.ts`
serves `vite preview`, and Netlify's Vite plugin registers `configureServer` and
no `configurePreviewServer`. The endpoint is route-stubbed exactly as GitLab
already is, and the credential rules are proved by a Vitest project against a
real signature minted in-test. This is stated in `tasks.md` rather than left to
be discovered, and it is why TEAM-3's scenarios are cited by handler tests.

**`bun run verify` is red from the moment this delta exists** until every new
requirement is cited by a scenario, because `check-traceability.ts` reads
non-archived changes. The task order accounts for it; the previous change
recorded the same trap.

**Netlify Free is a hard cap that pauses every site on the account** → an
endpoint that did work before checking a credential would be a denial-of-service
path into it. Ordering is the mitigation: parse, verify, then touch the store.
There is no platform rate limiting on the plan, so a usage notification on the
account is the real control and belongs in the release checklist.
