## Why

The team screen reports a GitLab group, and a team is not a GitLab group. The gap
shows up twice, in opposite directions, and neither side can be closed from
inside the group.

Rows arrive from the group's membership unioned with everyone observed logging
time in it, so somebody from another squad who touched one issue in the group
gets a row the lead did not ask for. Figures come from
`group(fullPath:) { timelogs }`, which GitLab scopes to that group and its
descendants, so a teammate who logged twenty hours on an issue in a sibling group
is not missing from the answer — it was never asked for. Widening to an ancestor
group recovers those hours and makes the row problem worse: it drags in every
other squad under that ancestor.

It is buildable now because `Resolvers::TimelogResolver#validate_args!` permits a
non-admin when `has_parent?(object, args)`, and `has_parent?` tests `object`
generally rather than testing for a Group or a Project. A `User` parent satisfies
it, `UserInterface.timelogs` carries no field-level `authorize:`, and
`TimelogsFinder` builds `parent&.timelogs` with no namespace scoping. So
`users(usernames:) { nodes { timelogs } }` reads chosen people's hours across
every namespace, for any authenticated reader.

That shape is also faster than what it replaces, structurally rather than by
optimisation. A group's month must be paged in full before any one row is
settled, because an entry for anybody can be on the next page; asking per person
completes each person's month in a single page. There is no read frontier left,
so rows are final on first paint instead of the grid sitting at `pending` behind
the slowest read.

## What Changes

- **BREAKING** `/team` reports a **team** — a list of people the reader keeps —
  instead of a GitLab group. The group view is replaced, not kept alongside.
- A team is persisted per reader and survives a change of device. This is the
  app's first server-side state.
- A new screen at `/teams` makes, names, edits and deletes teams. It is reached
  from a link beside the team picker and a card on `/settings`, and adds no
  navigation link: "Equipe" beside "Equipes" at 375 px costs a reader more than
  one extra click does.
- A team is seeded from **whoever logged time in a group**, over a stated
  trailing window — not from the group's membership. A membership list is a list
  of people with access, most of whom may never have touched time tracking. The
  honest price is a paged read of a group's timelogs where a membership list cost
  one cheap page.
- Every person the reader chose keeps a row, including one who logged nothing.
  The rule this reverses — drop a row with no figures once the month is read —
  existed because the screen measured one group and an hour logged elsewhere was
  invisible from it. The measurement is now the person, so an empty row is a
  claim the screen has evidence for, which is what makes it worth drawing.
- A row total is the person's **true total**, including hours on work the reader
  cannot open. `TimelogConnection.count` and `totalSpentTime` are computed over
  the relation before the provider removes what the reader may not read, and
  those hours are folded into the figures rather than drawn beside them. What a
  cell cannot open is said to assistive technology.
- An **optional group filter**, empty by default, narrows every figure to one
  group and its descendants. Empty, the report reaches everywhere the provider
  counts — including personal projects and work items belonging to no project.
  The two states are different claims, and the screen says which one it is
  making.
- A cell may, for the first time, say that a person logged nothing — but only
  where the provider's own count over that span is zero, and only in the words
  the reach allows. Unscoped that means "logged nothing anywhere the provider
  counts"; scoped it means "nothing in this group", which is the weaker sentence
  the screen makes today and must keep making whenever a filter is set.
- A team stores each member by the user id GitLab says cannot change, with the
  username beside it as the address. A username is released on rename and another
  account may claim it, so a roster matched on one alone can come to point at a
  different person with nothing on screen to say so.

Not in this change, deliberately: sharing a team with another reader — the stored
shape carries a per-team id so it can be added without a migration — any
breakdown of _what_ a person worked on, and any export.

## Capabilities

### New Capabilities

- `saved-teams`: a team is a name and a hand-picked list of people, kept against
  the reader who made it — how it is stored, what stops one reader addressing
  another's, what the device may keep, and what happens when a write does not
  land.

### Modified Capabilities

- `group-timelog-report`, **renamed to `team-timelog-report`**. Sixteen of its
  twenty requirements change or are added; none are removed. Nothing in it turns
  out to be about a group except by accident of wording, which is why the
  requirement ids stay `GROUP-n` rather than being renumbered: they are the
  thread `scripts/check-traceability.ts` pulls, and keeping them is what lets a
  reader follow one requirement through two shapes in `git log`. The rename
  itself lands at archive time — OpenSpec forbids renaming a capability inside a
  delta, so the delta is written under the existing path and the directory moves
  with `git mv`, the citations with one substitution. Neither costs anything:
  the citation regex treats the capability name as `\S+` and never validates it.
- `gitlab-authentication`: the application asks for `openid` beside `read_api`,
  so it can obtain an identity assertion the teams store verifies for itself.
  AUTH-7's read-only guarantee is about authority over data and is unchanged —
  `openid` grants none — but its scenario asserts the exact scope string, and
  that has to say what the string now is rather than say "and no other".

## Impact

**Renamed slice.** `src/entities/group-timelogs/` becomes
`src/entities/team-timelogs/`. `model/roster.ts` and
`src/pages/team-hours/lib/rows.ts` are deleted outright: the roster union cannot
occur when the query returns only the people it was asked about, and the
drop-an-empty-row rule loses its premise. `model/withheld.ts` changes in two
identifiers and keeps all three of its checks — one of them gets stronger, since
the group version narrowed by `username:` inside the connection on each of
thirty-two aliases and the new one states the person once, in the parent.
`model/window.ts` and `model/columns.ts` are untouched.

**New slices.** `src/entities/teams/` (the stored shape and its HTTP adapter),
`src/pages/teams/`, and `src/features/group-picker/` — the picker now has two
consumers, one seeding a team and one filtering a report, which is what steiger's
`insignificant-slice` rule wants and what a one-consumer `features/` slice would
have failed.

**GitLab.** `users(usernames:)` replaces the group page document and carries the
aggregates on its first round, so the separate month probe disappears. A per-node
cursor cannot travel back through `users(...)`, so continuation is a second,
aliased document over `Query.user(username:)`, batched against the 250-point
budget. The column probe is re-parented and drops its `username:` argument. The
group filter must be threaded through all three of those documents and all three
query keys, or through none: an instrument measuring a different set than the
figures makes every shortfall on the screen nonsense.

**First server-side state.** One Netlify Function at `/.netlify/functions/teams`
over Netlify Blobs. It is same-origin, so `connect-src 'self'` already permits it
and `scripts/write-csp.ts` needs no change — which is the whole reason it is
same-origin. It authenticates by verifying GitLab's OIDC `id_token` offline
against `https://gitlab.com/oauth/discovery/keys` and derives the storage key
from the verified `sub`, never from anything the request carried. No new
environment variable: it reads the same `VITE_GITLAB_CLIENT_ID` and
`VITE_GITLAB_BASE_URL` the bundle is built with.

**OAuth.** The scope becomes `read_api openid`. The `id_token` lives 120 seconds
and the refresh grant re-mints it, so it is minted on demand through the existing
single-flight renewal rather than held, and never reaches storage — exactly as
the access token does not. **The `openid` scope must be ticked on the GitLab
application before the bundle asking for it is deployed**, or every sign-in fails
with `invalid_scope`.

**Dependencies.** `jose` and `@netlify/blobs` as runtime dependencies,
`@netlify/functions` for types. `bun audit` must stay at zero at any severity,
and whatever is adopted for local function development is the largest exposure in
this change — it is gated on an audit run, with a thirty-line dependency-free
fallback, because the handler is a `(Request) => Response` and that is all a Vite
middleware needs.

**Gates that do not see a top-level directory.** `tsconfig.json`,
`knip.config.ts` and `dependency-cruiser` all scope to `src` and must be widened.
ESLint already excludes `netlify/` from the browser-only rule by path glob —
worth a comment, so nobody later "fixes" that glob and breaks the function.

**The acceptance suite cannot run the function.** `playwright.config.ts` serves
`vite preview`, and Netlify's own Vite plugin registers `configureServer` and no
`configurePreviewServer`. The endpoint is route-stubbed exactly as GitLab already
is, and the function's own rules are proved by a Vitest project against a real
signature.

**Process.** `openspec/config.yaml` says "There is no backend and no database"
and describes the product as reporting a group; `README.md` says "there is no
backend and no database to run or pay for". Both stop being true. `AGENTS.md`'s
decision "No sentence on the team screen says somebody logged nothing" becomes
**conditional rather than reversed** — with a filter set, the original
prohibition returns verbatim and for the original reason, and the strings that
carry it stay in the catalogue. `scripts/check-traceability.ts` reads
non-archived changes, so `bun run verify` fails from the moment this delta exists
until every new requirement is cited; the task order accounts for it.

**Three questions this change opens read-only and answers before it commits.**
Whether `Query.users` declares its own complexity or takes graphql-ruby's
connection default — the batch size is a measured constant either way, and the
document always passes the batch length as `first`, so the multiplier can never
be a hundred. Whether `users(ids:)` resolves end to end, which would let the
roster be addressed by id and remove the rename hazard rather than detect it. And
whether `timelogs(groupId:)` takes the group's id rather than its path, which the
picker hands back — a wrong-scope bug there is silent.
