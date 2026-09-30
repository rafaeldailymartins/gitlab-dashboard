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

**Forget through the same navigation that remembers.** The route's `onChange`
already calls `rememberTeam` with whatever the address becomes. Asking it to
move to `team: ''` both removes the key and re-enters the bare-address path, so
`chosenTeam` completes to the first team or to the invitation, exactly as
GROUP-14 says, with no second code path for "what a bare address shows". It
replaces the history entry rather than pushing one, so Back does not return to
the dead address. The condition is a pure helper in `lib/`, beside
`address-after-save.ts`, so it is unit-tested apart from the page.

**One reconnect control, used twice.** Both notices get the same button, labelled
by one new message, calling `signIn` with the current location's href. The
report's notice and the dialog's are in different slices (`pages/team-hours`,
`widgets/team-manager`), so the button lives in the lower one and the page
imports it — or, if steiger objects to the direction, each renders its own
`Button` over the same `useSession().signIn`. The label says what happens next,
not "retry": the reader is leaving for GitLab.

**The caption says what the figures are, in both states.** Unnarrowed, it stops
saying "including work this account cannot open" and says the hours are not
counted in and that a row says how many are missing. Narrowed, "may include"
stays: there placement can fold them in, and "may" is true.

## Risks / Trade-offs

- [The forgetting fires on a list that is still loading, or failed] → it runs
  only once the list has answered with no failure; a store that cannot be read
  says so (GROUP-1) and forgets nothing.
- [A reader deletes the remembered team and keeps none] → the bare address then
  invites them to make one, which is GROUP-14's no-teams case, not an error.
- [The reconnect sends a reader to GitLab mid-edit in the dialog] → the notice
  appears only when the store refused for want of an identity, so there is
  nothing the store would have accepted; the draft is lost as any navigation
  loses it, and the dialog already asks before a dismissal with unsaved edits —
  the control is labelled as leaving.
