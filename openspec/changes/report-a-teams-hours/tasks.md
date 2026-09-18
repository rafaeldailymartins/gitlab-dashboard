# Tasks

## 1. What GitLab will actually answer

Read-only. No behaviour changes here; each answer fixes a constant or chooses
between two equivalent shapes, and each is recorded in `design.md` beside the
decision it settles.

- [x] 1.1 Measured against the real instance with `queryComplexity` embedded in
      the document: 26 points for one person, 29 for sixteen, limit 250. The
      additive model holds and roster size is not a complexity constraint, so
      there is no batching constant to tune — the bound is the connection's own
      hundred-node page cap; recorded in `design.md`
- [x] 1.2 Confirmed: `users(ids: [ID!])`, `user(id: UserID!)` and
      `user(username: String!)` all resolve, return `username`, and agree exactly
      on `count` and `totalSpentTime`. The roster is addressed by identifier, so
      the rename hazard is removed at the source rather than detected downstream;
      recorded in `design.md`
- [x] 1.3 Confirmed, and the type is `GroupID` rather than `ID` — the provider
      refuses the wrong one, so this is an error and not a silent wrong scope.
      `users(ids:)` takes `[ID!]` and `user(id:)` takes `UserID!`: three scalar
      types, all different. The filter narrows on real data by a factor of five;
      recorded in `design.md`
- [x] 1.4 Measured: sixteen people cold ~5.5 s, warm ~2.5 s, and concurrent
      chunks ~2.0 s. Chunking does not pay for its constant, so the gateway sends
      one request for the team; recorded in `design.md`
- [ ] 1.5 Decode a real `id_token` and record `exp − iat` — every statement of
      120 seconds is GitLab's documented default, not an observation of this
      instance; verify by hand and record in `design.md`

## 2. The written record, first

`bun run verify` fails from here until task group 11 cites every new requirement.
That is expected and is why the feature files are their own group.

- [x] 2.1 Write `proposal.md`; verify `bunx openspec validate report-a-teams-hours --strict`
- [x] 2.2 Write the delta specs for `group-timelog-report`, `saved-teams` and
      `gitlab-authentication`; verify the same command
- [x] 2.3 Write `design.md`; verify the same command
- [x] 2.4 Write `tasks.md`; verify the same command

## 3. Two dead keys, and the gate that missed them

- [x] 3.1 Delete `team_people_count` and `team_loading_floor` from both
      catalogues — nothing has referenced either since the change that added
      them; verify `bun run i18n:check`
- [x] 3.2 Extend `scripts/check-messages.ts` to fail on a key no file under
      `src/` names as `m.<key>` — with no parenthesis required, because every
      theme, locale and sign-in-failure string is handed to a lookup table as a
      function reference and a stricter pattern would report eight live keys as
      dead; verify it fails on a planted key and passes on the catalogue, with
      `bun run i18n:check`

## 4. The function, before anything calls it

- [x] 4.1 Add the stored shape and its strict validator, bounded at fifty teams,
      two hundred members, a hundred-character name and sixty-four kilobytes;
      verify `bun run test`
- [x] 4.2 Write the failing handler tests over an in-memory store: no credential
      is refused; a credential that will not verify is refused identically; a
      read returns only the caller's own; nothing in the request can name another
      key; an over-bounds body is refused without being echoed; verify `bun run test`
- [x] 4.3 Write the failing verifier tests against a key pair minted in-test:
      the right key is accepted; a second key, a tampered byte, a wrong audience,
      a wrong issuer, an expired token, an `iat` beyond the age bound and
      `alg: none` are each rejected; verify `bun run test`
- [x] 4.4 Implement the handler and the verifier until 4.2 and 4.3 pass, with the
      storage key derived from the verified subject and nothing else from the
      payload leaving the verifier; verify `bun run test` and `bun run lint`
- [x] 4.5 Add the blob adapter with strong consistency and a conditional write on
      the stored version, answering a conflict with the current document. It is
      the one module here no test reaches: `getStore` throws outside the
      platform, which is why the store is a port and why the handler's rules are
      proved against an in-memory one. What the adapter is held to is the port's
      contract and a deploy; verify `bun run typecheck` and `bun run lint`
- [x] 4.6 Add the function entry point, its `netlify.toml` entry, and the
      `tsconfig`, `knip`, `dependency-cruiser` and `vitest` entries the new
      directory needs; verify `bun run typecheck`, `bun run deadcode` and
      `bun run arch:graph`
- [x] 4.7 Add a dev-server path to the function so `bun run dev` has a working
      endpoint — a thirty-line Vite middleware over the same handler rather than
      Netlify's emulator, because the README records this project rejecting a
      tool for its dependency tree and `bun audit` must stay at zero. The
      identity check there is the real one against the real provider's keys; the
      store is in memory, so a restart forgets and nothing lands on a developer's
      disk; verify `bun run security:audit` and by hand
- [x] 4.8 Confirm the built policy still reads `connect-src 'self' <gitlab origin>`
      with no origin added — the function is same-origin, which is the whole
      reason it is a Netlify function; verify `bun run build`

## 5. Identity, end to end

- [x] 5.1 Add `openid` to the requested scope and carry an optional identity
      assertion through the token response and the session, held in a closure and
      never in storage; verify `bun run test`
- [x] 5.2 Add the pure reader of an assertion's expiry, returning nothing for a
      token that is not three parts, whose payload is not base64url JSON, or
      whose `exp` is not a finite number — each of which makes the caller treat
      the identity as already due; verify `bun run test`
- [x] 5.3 Add `identityToken()` to the session manager, renewing through the
      existing single flight so a burst costs one exchange and one rotation;
      verify `bun run test`
- [ ] 5.4 Report a session granted before the scope as its own failure kind, and
      render the reconnect offer on the teams surface only — never a sign-out;
      verify `bun run test` and `bun run typecheck`
- [ ] 5.5 Widen the acceptance assertion that reads both storages so it covers
      the identity assertion as well as the access token; verify `bun run test:e2e`

## 6. Model: the team, and who the provider recognised

This group splits by slice, and the halves cannot land together. 6.3 is about
`entities/teams` and stands alone. 6.1, 6.2, 6.4 and 6.5 are about the reading
slice, and every one of them would be an island there until the report's gateway
and page switch over — `steiger` fails a slice nothing references and `knip`
fails an export nothing imports, both of which were confirmed by building the
teams slice and watching them fire. So they move to group 8, beside the boundary
that consumes them.

- [ ] 6.1 Write and pass the tests for rows being exactly the team's members,
      nobody added and nobody dropped, ordered by a comparison that cannot vary
      by machine; verify `bun run test`
- [ ] 6.2 Write and pass the tests for reconciling stored members against
      resolved nodes — confirmed, reassigned, unresolved — matched on the
      returned username and never on position; verify `bun run test`
- [x] 6.3 Write and pass the tests for the team edits: add, remove, rename, new,
      each total and each returning a fresh team, with adding somebody already on
      the team a no-op rather than a duplicate row; verify `bun run test`
- [ ] 6.4 Write and pass the tests for suggestions: deduped by identifier, bots
      dropped, blocked accounts kept because an inactive account that logged time
      did the work, order stable; verify `bun run test`
- [ ] 6.5 Delete the roster union and the rule that dropped a row with no
      figures, with their tests; verify `bun run test` and `bun run deadcode`

## 7. Model: what a figure and a cell may claim

- [ ] 7.1 Write and pass the tests moving completeness and the read frontier onto
      the row, with a case on each side of the boundary so the comparison mutants
      die; verify `bun run test`
- [ ] 7.2 Write and pass the tests for the cell kind that means the provider said
      nothing and never will, distinct from the one that means more may still
      arrive; verify `bun run test`
- [ ] 7.3 Write and pass the tests for the two-state claim: unscoped, a declared
      count of zero means the person logged nothing; scoped, the same zero claims
      only that the group holds nothing — a case each side, so a mutant dropping
      the filter from the decision dies; verify `bun run test`
- [ ] 7.4 Write and pass the tests that a placed difference is not also reported
      as missing, and that a difference running the other way still is; verify
      `bun run test`
- [ ] 7.5 Re-parent the placement's three checks without changing one of them,
      and prove the period check still catches an identifier that resolves to
      nobody; verify `bun run test`
- [ ] 7.6 Decide and implement where the column placement runs, given that an
      unscoped read makes almost every row short and inverts the economics the
      cap was chosen under; record the decision in `design.md`; verify
      `bun run test`
- [ ] 7.7 Confirm the model floors; verify `bun run test:coverage` and
      `bun run test:mutation`

## 8. The GitLab boundary

- [ ] 8.1 Write the page document, the continuation document, the column probe
      and the person search, each carrying the comment saying why it is shaped
      that way, each taking every value as a variable and never interpolating
      provider data into a document; verify `bun run test`
- [ ] 8.2 Thread the group filter through all three user documents and all three
      query keys, and write the gateway test that proves they carry the same one
      — an instrument measuring a different set than the figures makes every
      shortfall on the screen nonsense; verify `bun run test`
- [ ] 8.3 Write the gateway test that a read stops on `hasNextPage` and on
      nothing else, since a page can carry zero nodes and still have more; verify
      `bun run test`
- [ ] 8.4 Replace the membership document with one that reads whoever logged time
      in a group over the stated window, and delete the roster document, its
      query, its gateway method and the access type with it; verify
      `bun run deadcode` and `bun run test`
- [ ] 8.5 Assert that every document sends `startTime` and `endTime` and never
      `startDate` or `endDate`, and never `startTime` with `endDate`; verify
      `bun run test`
- [ ] 8.6 Record the fixtures from a real response rather than writing them —
      the aggregate's string form, the identifier forms, a nullable node and the
      absence of a node for an unresolved username are things only a real answer
      gets right; verify `bun run test`
- [ ] 8.7 Rewrite the slice's public API deliberately rather than patching it; a
      stale export is a dead-code failure, not a type error; verify
      `bun run deadcode`

## 9. The teams store in the browser

- [x] 9.1 Add the teams slice with a lenient decoder that falls back field by
      field, paired with the function's strict validator; verify `bun run test`
- [ ] 9.2 Add a contract test running one table of documents through both halves,
      so the lenient and strict readers cannot drift; verify `bun run test`
- [x] 9.3 Add the HTTP adapter with one forced-renewal retry on refusal, mirroring
      the GraphQL client's single retry; verify `bun run test`
- [ ] 9.4 Put `meta: { persist: false }` on every teams query, copying the
      pattern the group queries already use. Without it `shouldDehydrateQuery`
      writes colleagues' names into IndexedDB through the cache persister, which
      is the easiest thing in this change to forget and the most consequential;
      verify `bun run test` and `bun run test:e2e`
- [ ] 9.5 Report a write that did not land as not saved, leave the team as it
      was, and queue nothing for later; verify `bun run test`

## 10. The two screens

- [ ] 10.1 Add every message key to both catalogues, as two sentences where the
      reach has two states rather than one sentence with a parameter — an empty
      parameter renders a double space and a claim nobody made; verify
      `bun run i18n:check` and the gate from 3.2
- [ ] 10.2 Move the group picker into its own slice taking its wording as props
      and a clearable flag, now that two screens use it; verify
      `bun run arch:layers`, `bun run arch:graph` and `bun run deadcode`
- [ ] 10.3 Replace the group picker on the report with a team picker on the
      existing select field, and add the group filter beside it, writing to the
      address and never to storage; verify `bun run build && bun run size`
- [ ] 10.4 Grow the screen-state resolution to cover having no teams, an unknown
      team, an empty team and a store that cannot be reached, with its own test
      file; verify `bun run test` and `bun run lint`
- [ ] 10.5 Make the caption, the reach line, the empty cell and the key read off
      the filter; verify `bun run test` and `bun run lint:a11y`
- [ ] 10.6 Fall back to the unscoped report when the address names a group that
      cannot be read, and say that it happened; verify `bun run test:e2e`
- [ ] 10.7 Build the teams screen — the list, the editor, the member list whose
      remove button is named for its person rather than twelve buttons called
      "Remove", and the individual search; verify `bun run lint:a11y` and
      `bun run test`
- [ ] 10.8 Build the suggestion list over the trailing window, capped and deduped,
      stating its window and saying when it may be incomplete, in its own lazy
      chunk; verify `bun run build && bun run size`
- [ ] 10.9 Wire the mutations, reporting saved, not saved and changed elsewhere in
      a live region that does not move focus; verify `bun run test`
- [ ] 10.10 Add the route, the link beside the team picker and the card on the
      settings screen — and no fifth navigation link; verify `bun run test:e2e`

## 11. Traceability

- [ ] 11.1 Rewrite the domain features for the team shape, keeping the window and
      placement scenarios verbatim where nothing about them changed; verify
      `bun run test` and `bun run arch:trace`
- [ ] 11.2 Split the step that asserted nothing on the screen says anybody logged
      nothing into two: the scoped state keeps the original expression verbatim,
      because that assertion is what caught the original bug and is still live;
      the unscoped state asserts its opposite; verify `bun run test:e2e`
- [ ] 11.3 Add the roster feature covering suggestions, identity and the team
      edits; verify `bun run test` and `bun run arch:trace`
- [ ] 11.4 Add the acceptance feature for keeping a team; verify `bun run test:e2e`
- [ ] 11.5 Add the teams screen to the screen sweep and the 375 px sweep, and
      leave the navigation outline at four rows; verify `bun run test:e2e`
- [ ] 11.6 Cite the store's credential requirements from handler tests rather
      than the browser, and say so where the citation lives — the acceptance
      suite serves a static build and carries no function; verify
      `bun run arch:trace`
- [ ] 11.7 Confirm every requirement is cited and add no exemption without a
      written reason beside it; verify `bun run arch:trace`

## 12. The end-to-end regression

- [ ] 12.1 Assert that a team member who logged nothing keeps a row and that it
      says so, and that a row whose month could not be read in full claims less;
      verify `bun run test:e2e`
- [ ] 12.2 Assert that scoping to a group changes every figure and the caption,
      that clearing it restores them, that the address carries it, and that a
      fresh visit is unscoped; verify `bun run test:e2e`
- [ ] 12.3 Assert that a team seeded from a group does not follow it, that a bot
      is not offered and that a blocked contributor is; verify `bun run test:e2e`
- [ ] 12.4 Assert that no figure and no colleague's name reaches the device, and
      that signing out leaves neither; verify `bun run test:e2e`
- [ ] 12.5 Close the hole in that assertion: it reads `indexedDB.databases()`
      into a `names` binding and then asserts nothing about it, so the persisted
      query cache — the one place a roster could land without touching
      `localStorage` — is collected and dropped. Assert it; verify
      `bun run test:e2e`

## 13. The written record, corrected

- [ ] 13.1 Rewrite `openspec/config.yaml`: it says there is no backend and no
      database, and describes the product as reporting a group; verify
      `bunx openspec validate report-a-teams-hours --strict`
- [ ] 13.2 Rewrite `README.md`: the same two claims, plus the data-flow diagram,
      the scope in the setup steps, and a security paragraph saying what the
      endpoint holds, how identity is established, that the token is used and
      discarded, and that the host holds the rosters unencrypted; verify by hand
- [ ] 13.3 Rewrite the `AGENTS.md` decisions this reverses. "No sentence on the
      team screen says somebody logged nothing" becomes **conditional, not
      reversed** — with a filter set the original prohibition returns verbatim
      and for the original reason. Its parenthetical about not widening the scope
      is now the reasoning for widening it. "A row is for figures; whoever has
      none is named under the table" is already wrong on its second half today
      and is now wrong on both. Add the folder-map entries and new decisions for
      the threaded filter, suggestions-are-who-logged, the filter being in the
      address and not remembered, the minted-not-held assertion, and the derived
      storage key; verify by hand
- [ ] 13.4 Rewrite `docs/qa/regression-checklist.md`'s team section — one line
      describes a presentation reverted by the previous change — and add the
      scoping passes and a teams section; verify by hand
- [ ] 13.5 Rewrite `docs/qa/accessibility-audit.md` step 14 as two steps, one per
      reach state, since the spoken text differs and only a listener can tell;
      extend the withheld step; add the teams-screen steps; verify by hand
- [ ] 13.6 Update `docs/qa/quality-metrics.md` counts, `test-plan.md` for the new
      Vitest project, and `release-checklist.md` for the scope ordering
      constraint and the usage notification; verify by hand

## 14. Every gate

- [ ] 14.0 Pin down an intermittent test failure seen twice, both times with
      `bun run test` sharing a shell with other gates and never in a dedicated
      run: one test of 1245, reported as an unhandled rejection
      (`Promise unknown:1:11`) rather than a failed assertion, with the suite's
      `setup` time varying between 7 s and 49 s across runs. The `ui` project sets
      `isolate: false`, which `vitest.config.ts` records as a deliberate trade and
      which is where a rejection in one file can surface in another. Not yet
      attributed to this change or to what was there before; verify by running
      the suite under load until it reproduces
- [ ] 14.1 `bun run verify && bun run test`
- [ ] 14.2 `bun run test:coverage` and `bun run test:mutation`
- [ ] 14.3 `bun run test:e2e`
- [ ] 14.4 `bun run build && bun run size`
- [ ] 14.5 Against a real account, confirm a row total matches what GitLab reports
      for that person including a project the reader cannot open and a work item
      with no project, and that scoping to a fully readable group reports no
      shortfall; no fixture can prove this one; verify by hand and record
- [ ] 14.6 From a second real account, confirm one reader cannot read another's
      teams through the deployed function; no fixture can prove this one either;
      verify by hand and record

## 15. Archive

- [ ] 15.1 Rename the capability: `git mv` the spec directory to
      `team-timelog-report`, retitle it, rewrite its Purpose, rename the four
      scenario headings whose wording OpenSpec required the delta to keep, and
      substitute the citation prefix in the feature files — the citation
      expression matches the capability as `\S+` and never validates it; verify
      `bun run arch:trace`
- [ ] 15.2 Archive the change; verify `bunx openspec validate --strict` and
      `bun run verify`
