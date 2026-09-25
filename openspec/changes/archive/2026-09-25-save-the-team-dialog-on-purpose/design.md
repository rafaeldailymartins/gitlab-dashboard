# Design

## 1. Where the draft lives, and where it must not

A `useState` in a new hook under `widgets/team-manager/lib/`, holding
`readonly Team[] | null` — null meaning "nothing edited yet, read the store".

Not in `use-team-edits.ts`. That hook is 112 lines with one query, one mutation
and a return; adding draft, dirty, save, discard and conflict-onto-draft breaches
`max-statements: 15` and `complexity: 8` (`config/eslint/limits.js:14-23`), and
AGENTS.md requires a recorded reason beside any raised ceiling. A second module
is cheaper than an excuse.

**Not on the device, in any form.** TEAM-2 and GROUP-18 forbid a roster reaching
storage, and `tests/e2e/support/device.ts:29-57` already reads `localStorage`,
`sessionStorage` and every IndexedDB object store by content — so a draft parked
anywhere persistent fails `keep-a-team.feature:112` rather than shipping. The
draft dies with the dialog, which is the behaviour, not a gap.

**Not in the query cache.** `useSavedTeams` and `useTeamEdits` both subscribe to
`TEAMS_KEY`, and the report behind the dialog reads the first. Writing a draft
there would repaint the month under the reader and make Cancel a problem of
un-repainting a report they have been reading.

## 2. What Save writes, and what a refusal does

One `PUT` of the whole document, against the etag the query holds — the same
call as today, once instead of N times. This is what removes the lost-edit race
described in the proposal: there is one write built from one snapshot.

The etag is read at Save, not at open. `teamsQuery` has `staleTime: 5 min` and
`refetchOnWindowFocus: false`, so a dialog left open does not refresh it; reading
it late does not make the value fresher, but it does mean the conflict is decided
against whatever the cache learned in the meantime rather than against a value
captured on mount.

On a conflict, `onError` today replaces the cache with the other device's
document. It still should — the reader has to see what is now stored — but the
**draft stays**. The notice says the team was changed somewhere else; the draft
is still on screen; Save is offered again, now against the newer etag. That makes
a second Save a deliberate overwrite rather than a silent one, which is the
honest shape for a surface whose refusals are reported rather than resolved
(TEAM-4, TEAM-5).

`send` in `teams-gateway.ts:128-142` resubmits once behind a forced renewal on a
401, so one Save can legitimately be two PUTs. Any write-count assertion has to
say "at least one" or count differently.

## 3. Closing, and the three ways out

`DialogContent` always renders a close X (`shared/ui/dialog.tsx:58-65`) and Base
UI dismisses on Escape and on the backdrop. Two dismissing controls is not
avoidable, so the answer is not to remove one but to route all of them through
the same decision.

The dialog does not own its open state — `team-manager-dialog.test.tsx:45` pins
_"asks to be closed rather than closing itself"_ — and it is mounted from two
callers (`team-hours-page.tsx:145` and `settings/ui/teams-card.tsx:121`). A guard
written at each caller is written twice and drifts. So the dialog intercepts its
own `onOpenChange`: clean, it forwards; dirty, it shows the confirmation instead.
That test's claim survives — the dialog still never closes itself, it asks — but
its wording and its unanchored `/close/iu` locator both have to change, because a
Cancel button's accessible name would make that locator ambiguous.

The confirmation is **not** a nested dialog. A second focus trap inside a focus
trap is the thing the keyboard sweep would catch and the reader would feel; an
inline bar inside the existing footer, with the two answers as buttons, is one
trap and one tab ring.

## 4. The live region is already spoken for

`SaveNotice` is a permanently-mounted polite `role="status"` and it is this
surface's only one. The acceptance suite reads it with an **unscoped**
`page.getByRole('status')` (`tests/e2e/steps/teams-store.ts:72-93`), which
resolves to one element only because the modal hides the report's own status
region from the accessibility tree. A second live region — "you have unsaved
changes" beside Save — makes three existing steps ambiguous.

So the dirty state is **not** announced as status. It is carried by the Save
button's own enabled state and by its label; a live region is for what changed
without the reader doing it, and the reader is the one who typed.

## 5. The two ways the picker goes blank

They are different bugs and want different fixes. Neither may become "fall back
to the first team": GROUP-14 requires an address naming a team that is not the
reader's to say so, `chosen-team.ts:47-49` is what says it, and
`team-hours-page.test.tsx:203` and `chosen-team.test.ts` assert it.

**A remembered identifier that names nothing** is GROUP-20's unimplemented
clause. Forgetting it in `beforeLoad` is not available: `router.tsx:5-10` builds
the router with no context, so nothing there can reach the query client, and the
teams query is `persist: false` so there is no cached document to read either.
The screen can see the list, so the screen forgets it — on arrival, when the
address names a team the loaded list does not have and that identifier is also
what was remembered.

**The addressed team deleted inside the visit** never touches `remembered` at
all. The save that removed it is the event, and the address moves with it. The
new team is taken **from the written document**, never from what the dialog
minted: `withTeam` (`entities/teams/model/edits.ts:90-94`) returns the list
unchanged at `MAX_TEAMS` or on a duplicate id, the write still succeeds and the
notice still says "Saved." — so a callback firing with a minted id would point
the address at a team that does not exist, manufacturing the exact state this
change removes.

There is a third, quieter thing here worth naming rather than fixing silently:
`chosen-team.ts:41-45` completes a bare address by **filling the screen in
behind it**, while AGENTS.md says a bare address is completed by _redirecting_,
"so what you are looking at stays what you can send somebody else". The fallback
reversed that without saying so. This change does not settle it — the fallback is
what makes a freshly created first team appear at all — but the spec delta stops
pretending both rules hold.

## 6. What a draft breaks that is not a test

- **The name field keeps its own draft.** `team-name-field.tsx:42` seeds
  `useState(team.name)` once and is remounted only by `key={chosen.id}`; its
  docstring rejects reseeding from an effect because that would overwrite what
  the reader is typing. A Save pressed while it holds uncommitted text drops the
  rename, and a Cancel leaves the reverted-away name in the input. The name has
  to join the document draft, and that docstring has to be rewritten rather than
  trimmed.
- **A group read outlives a Cancel.** `use-manager-state.ts:80-86` is
  `void seeding.read(path).then(merge)` with no cancellation — up to four
  sequential pages. Cancelling or closing mid-read leaves a `.then` folding
  people into a draft that was thrown away. It needs a request identity checked
  before the merge, not an effect: `use-group-seeding.ts:44-65` records why this
  read is imperative rather than rendered, and that reasoning still holds.
- **`chosenOf` falls back to `teams[0]`.** Discarding a drafted new team drops
  the editor onto somebody else's team with no announcement, the same way
  cancelling a delete restores the team but not the selection.
- **The ceiling is enforced twice.** `team-rail.tsx:80` disables its button at
  `MAX_TEAMS` from `edits.teams`, which will read the draft correctly, but the
  endpoint enforces the same bound — a draft that accumulates past it fails at
  Save with everything else in the batch.

## 7. Budget

`.size-limit.js` allows 180 kB and the build is at 175.8 kB. Roughly four
kilobytes of headroom, and a confirmation reached from the entry path would spend
it. The footer and its two buttons are inside the dialog's own chunk, which is
already `lazy()` and prefetched, so nothing new lands in the entry.
