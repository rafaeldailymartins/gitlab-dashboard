## Context

See proposal.md for why. Most of this change is wording in the living specs and
in one caption; two pieces are code, and both have a constraint that decides
where they go.

- **The route cannot see the team list.** `_authenticated.team.tsx` redirects a
  bare address to the remembered identifier in `beforeLoad`, which reads only
  `localStorage`. The reader's teams arrive later, from the store, inside the
  page (`useSavedTeams`). So a dead identifier can only be recognised after the
  list has answered, and only on the page.
- **The session already knows how to come back.** `SessionProvider.signIn(destination)`
  stores a destination through `startSignIn` and leaves for GitLab; the callback
  route completes the exchange and navigates to it, and it has no signed-in
  guard. Authorising once more is what repairs a session granted before `openid`
  (AGENTS.md § OAuth scope). The notices already say to do it; nothing on
  screen does it.

## Goals / Non-Goals

**Goals:**

- A remembered team that is not in the reader's list is forgotten once the list
  is known, and the visit completes as a bare address does.
- The reconnect notice, on the report and in the teams dialog, carries a control
  that re-authorizes and returns the reader to the address they were on.

**Non-Goals:**

- Checking the remembered identifier in `beforeLoad`. The list is not there, and
  loading it there would put the teams gateway on every route's critical path.
- Building the per-week count GROUP-12 used to require. It is removed.
- Changing when placement runs. GROUP-1 and GROUP-19 are reworded to match it.

## Decisions

**Forget only what was remembered.** The page forgets when `chosenTeam` answers
`unknown` _and_ the addressed identifier equals the remembered one. An address
somebody sent naming a team that is not this reader's still says so (GROUP-14);
it cannot equal the remembered identifier unless it names the reader's own team.
The alternative — forgetting on any `unknown` — would turn a link to a colleague's
team into a silent redirect to the reader's first one, which GROUP-14 forbids.

The page cannot tell the two apart from what it is given today: with the address
naming `A` and a list holding only `B`, a remembered `A` and a sent `A` arrive as
the same props. So the route, which already reads the remembered identifier in
`beforeLoad`, hands it to the page. The page does not read storage itself: the
route is where remembering lives, and a page that read the device would be a
second place the rule is kept. The same holds with no teams left at all —
`chosenTeam` answers `none` and the invitation is right, but the address still
names the dead team and the key is still kept, so that case forgets too.

**Forget through the same navigation that remembers.** The route's `onChange`
already calls `rememberTeam` with whatever the address becomes. Asking it to
move to `team: ''` both removes the key and re-enters the bare-address path, so
`chosenTeam` completes to the first team or to the invitation, exactly as
GROUP-14 says, with no second code path for "what a bare address shows". It
replaces the history entry rather than pushing one, so Back does not return to
the dead address. The condition is a pure helper in `lib/`, beside
`address-after-save.ts`, so it is unit-tested apart from the page.

**One reconnect control, used twice.** Both notices get the same button, labelled
by one new message, calling `signIn` with the router's current href — the team
address carries the team, the month, the filter and the columns, and all of it
is where the reader was. The report's notice and the dialog's are in different
slices (`pages/team-hours`, `widgets/team-manager`), so the button lives in the
lower one and the page imports it. The label says what happens next, not
"retry": the reader is leaving for GitLab.

Only the notice shown when the teams **cannot be read** carries it. A write can
also fail for want of an identity after a read succeeded, with a draft on screen;
a control there would lose the draft to the round trip, and TEAM-2 forbids
keeping a roster anywhere it would survive one. That path keeps its sentence,
and the reader reaches the offer the next time the list is read.

`useSession()` throws outside a `SessionProvider`, which the test renderers in
`tests/support/report.tsx` do not supply; they gain one over a fake manager, so
a test can assert what `startSignIn` was asked for.

**The caption says what the figures are, in both states.** Unnarrowed, it stops
saying "including work this account cannot open" and says the hours are not
counted in and that a person's total notes any difference they make to it —
in either direction, because the shortfall is signed and a withheld correction
makes the figure too high rather than too low. Narrowed, "may include"
stays: there placement can fold them in, and "may" is true.

## Risks / Trade-offs

- [The forgetting fires on a list that is still loading, or failed] → it runs
  only once the list has answered with no failure; a store that cannot be read
  says so (GROUP-1) and forgets nothing.
- [A reader deletes the remembered team and keeps none] → the bare address then
  invites them to make one, which is GROUP-14's no-teams case, not an error.
- [The reconnect sends a reader to GitLab mid-edit in the dialog] → the control
  is on the read-failure notice only, where the dialog renders nothing else and
  no draft can exist.
- [`identity-unavailable` also covers a network failure while renewing] → the
  offer is then more than was needed, and harmless: authorising again succeeds or
  fails on its own terms, and the session is never signed out by it.
