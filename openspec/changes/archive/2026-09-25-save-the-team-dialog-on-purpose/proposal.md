# The teams dialog is saved on purpose, and the address keeps up

## Why

Two complaints about the same surface, and they turn out to share a cause.

**Every edit is a write.** Taking somebody off a team happens the moment the X is
pressed, and the only way back is to add them again — by name, through a search,
from memory. There is no way to change your mind about a change you have already
made.

That is a decision this repository made deliberately and wrote down
(`use-team-edits.ts`: _"Every edit is a save; there is no draft"_), on the
argument that a list built by clicking names would lose those clicks to a closed
tab. The argument is real. What it did not weigh is that the same property makes
every click final, on a surface whose whole job is a list of colleagues' names.

It also has a defect nobody was looking for. `apply` builds each write from the
query cache and closes over the etag read at that moment, with no mutation
scope — so two quick removals both build on the **original** roster. Proved
against a store that holds writes open: `etags = ["1","1"]`, `sizes = [2,2]`. The
second write reverts the first, and against the real endpoint it is refused with
a 409 and the notice blames _"changed somewhere else"_ for the reader's own two
clicks. A draft that batches the session into one write removes that race
entirely rather than papering over it.

**The team picker goes blank.** Create a team while the address names one that is
not in your list and the trigger renders empty — no name, no placeholder — beside
a note saying the team is not one of yours. There are two ways in, and only one
of them is what it looks like:

1. A remembered identifier that no longer names anything. `rememberTeam` is
   called from exactly one place, inside a navigation, so deleting a team never
   forgets it; the next visit is redirected into a dead address. **GROUP-20
   already forbids this** — _"A remembered team that no longer exists SHALL be
   forgotten rather than shown as a failure on arrival"_ — and nothing implements
   it. `arch:trace` never noticed because it matches requirement ids, not
   scenarios, and GROUP-20 is cited by two other scenarios.
2. Deleting the addressed team **inside the visit** and starting another. No
   reload, no redirect, nothing remembered: the address simply names a team the
   reader has just deleted themselves.

Neither is fixed by falling back to the first team, and GROUP-14 forbids that
anyway — an address naming a team that was never yours has to say so rather than
show you your own.

## What changes

- The dialog collects every edit into a **draft** and writes once, on **Save**.
  Cancel discards the draft. This covers the whole dialog, not one team: the
  document is one list of every team, so one Save is one write either way.
- Closing with unsaved edits **asks first**. Escape, the backdrop and the X all
  reach the same place, and all three currently discard nothing because there is
  nothing to discard.
- A Save refused because another device wrote first **keeps the draft on
  screen**. Today a refusal costs one click; after this it would cost a session,
  and discarding it silently is the one outcome that makes a draft worse than
  what it replaces.
- The report behind the dialog follows the **saved** document, not the draft.
- A remembered team that names nothing is forgotten, on the screen that can see
  the list — the router has no query client to ask.
- When a save leaves the addressed team no longer in the reader's list, the
  address is moved to one that is, **derived from the written document** rather
  than from what the dialog minted: `withTeam` silently refuses at the ceiling
  and on a duplicate id, and the write still reports success.

## Impact

- Specs: `saved-teams` TEAM-1 and TEAM-4 modified; `team-timelog-report`
  GROUP-20 gains the scenario its unimplemented clause always needed. No new
  requirement ids, so `arch:trace` stays green while the work is in progress.
- Code: a draft hook beside `use-team-edits.ts` rather than inside it — the
  existing hook is already near `max-statements`; the dialog's footer, which
  exists; the two callers that mount the dialog; `remembered.ts` and the report
  screen.
- Acceptance: six scenarios gain a save step, and two that reload mid-edit
  (`keep-a-team.feature:92` and `:104`) have to be rewritten rather than
  extended — a reload with an unsaved draft is now a different claim.
- Not in scope: the Settings screen keeps instant-apply. Its fields are a
  different bargain — the theme is applied before the first paint and the
  language remounts the tree — and PREF-7's reconciliation is built on there
  being no verdict to wait for.
