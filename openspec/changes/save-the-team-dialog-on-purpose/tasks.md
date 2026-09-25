# Tasks

## 1. The written record first

- [x] 1.1 Proposal, design and the two spec deltas; every scenario of TEAM-1,
      TEAM-4 and GROUP-14 carried, because a MODIFIED block replaces the whole
      requirement. Gate: `bunx openspec validate --all --strict`
- [x] 1.2 Confirm `bun run arch:trace` is still green. No new requirement id is
      declared, so it should be — the gate matches ids, not scenarios

## 2. The address, which is a defect and not a feature

Independent of the draft, and first because it is what the reader reported.

- [x] 2.1 A remembered identifier that names nothing is forgotten. Not in
      `beforeLoad` — `router.tsx` builds the router with no context, so nothing
      there can reach the query client — so on the screen that has the list
- [x] 2.2 Acceptance scenario for GROUP-20's clause, in
      `read-a-teams-hours.feature` where the other GROUP-20 scenarios live. The
      clause has been specified and unimplemented all along; nothing caught it
      because `arch:trace` matches ids and GROUP-20 is cited twice already
- [x] 2.3 A save that leaves the addressed team absent moves the address, taken
      from the **written document** rather than from the minted team. Gate: a
      unit test at `MAX_TEAMS` and on a duplicate id, where `withTeam` refuses
      and the save still succeeds
- [x] 2.4 `team-picker.test.tsx`, which does not exist. The trigger has no test
      of its own and its `empty` semantics are pinned only from
      `team-hours-page.test.tsx:187`

## 3. The draft

- [x] 3.1 A draft hook beside `use-team-edits.ts`, not inside it: draft,
      dirty, save, discard, and the conflict that keeps the draft. Gate:
      `bun run lint` — `max-statements: 15` and `complexity: 8` are why it is
      its own module
- [x] 3.2 `TeamActions` write into the draft. One write from one snapshot, which
      is what removes the two-edits-one-etag race
- [x] 3.3 The team name joins the document draft. `team-name-field.tsx` keeps its
      own uncommitted text today and is reseeded only by `key={chosen.id}`; a
      Save while it holds text would drop the rename, and its docstring has to
      be rewritten rather than trimmed
- [x] 3.4 A group read that resolves after a discard is dropped — a request
      identity checked before the merge, not an effect. `use-group-seeding.ts`
      records why this read is imperative and that reasoning still holds
- [x] 3.5 The report behind follows the saved document, never the draft

## 4. Saving, discarding and closing

- [x] 4.1 Save and Cancel in the footer that already exists at
      `team-manager.tsx:60`. **No `shadcn add dialog`** — it has overwritten
      `button.tsx` twice in this repository and installed a package that is not
      real
- [x] 4.2 The dialog intercepts its own `onOpenChange`: clean forwards, dirty
      asks. In the dialog rather than at each caller, because it is mounted from
      `team-hours-page.tsx` and from `settings/ui/teams-card.tsx` and a guard
      written twice drifts
- [x] 4.3 The confirmation is an inline bar in the footer, not a nested dialog —
      a focus trap inside a focus trap is what the keyboard sweep would catch
- [x] 4.4 The dirty state is **not** a live region. `SaveNotice` is this
      surface's only `role="status"`, and the acceptance suite reads it with an
      unscoped `getByRole('status')` that resolves to one element only because
      the modal hides the report's own. Gate: `bun run test:e2e`
- [x] 4.5 New strings in both catalogues. Gate: `bun run i18n:check`

## 5. The tests that have to change

- [x] 5.1 Six scenarios in `keep-a-team.feature` gain a save step
- [x] 5.2 `:92` and `:104` are rewritten, not extended: `"I open my teams again"`
      is a reload, and a reload with an unsaved draft is a different claim
- [x] 5.3 `:131` asserts exactly one PUT. Under a draft with no save it is zero —
      a failure on the low side. Note that `send` resubmits once behind a
      renewal on a 401, so one save can be two PUTs
- [x] 5.4 `team-manager-dialog.test.tsx:45` — "asks to be closed rather than
      closing itself" still holds, but its wording changes and its unanchored
      `/close/iu` locator becomes ambiguous beside a Cancel button
- [x] 5.5 A test for the race the draft removes: two removals in succession
      leave both people off, and neither is reported as somebody else's change

## 6. The written record corrected

- [x] 6.1 `use-team-edits.ts`'s docstring argues for save-on-edit in as many
      words. It is reversed here and the reversal is recorded where the argument
      was, not deleted
- [x] 6.2 `AGENTS.md`: the draft, why the report follows the saved document, and
      the two ways the picker went blank
- [x] 6.3 `AGENTS.md` is already stale about this toolbar — it describes the way
      into the dialog as "an icon button inside the team control's own border",
      and it is a labelled button at the far end
- [x] 6.4 `docs/qa/regression-checklist.md` and `docs/qa/accessibility-audit.md`

## 7. Every gate

- [x] 7.1 `bun run verify && bun run test`
- [x] 7.2 `bun run test:coverage`, `bun run test:mutation`, `bun run test:e2e`
- [x] 7.3 `bun run build && bun run size` — about four kilobytes of headroom
- [x] 7.4 `bunx openspec validate --all --strict`

## 8. What changed while building it

- [x] 8.1 TEAM-4's addition said the edits survive **any** refusal, which
      contradicted TEAM-5's own scenario — a conflict has to show the reader
      whose list it is now. Split: a store that could not be reached keeps the
      edits, a conflict takes them. The acceptance scenario for TEAM-4 was
      rewritten to match rather than patched
- [x] 8.2 The close question could not be located by its sentence: the footer's
      "Not saved yet" matches the same text. It is found by the choice it offers
- [x] 8.3 Saving and cancelling close; only a dismissal asks. Cancel is never
      disabled — it is the way out as much as the way to undo. A refused save
      does not close, because there is something left to read and to retry.
      `SaveNotice`'s "Saved." became unreachable in a browser and the acceptance
      step that read it was deleted rather than left asserting nothing can
      produce it
