# Tasks

## 1. The rule, before anything carries it

- [x] 1.1 `model/reconcile.ts`, test-first: given a local and a remote document,
      answer adopt / push / agree by the recorded instant. A document whose
      instant is unreadable carries **null**, not an epoch date: such a device
      adopts rather than competes, and pushes only against a store holding
      nothing. Gates: `bun run test:coverage` (100% on `model/`),
      `bun run test:mutation`
- [x] 1.2 `StoredPreferences` and its codec in `model/preferences.ts`: the
      envelope carries the instant, `Preferences` does not

## 2. The endpoint, before anything calls it

- [x] 2.1 `handle-teams.mts` becomes `handle-document.mts`, parameterised by key
      suffix, document and size — the suffix a constant the module chooses, never
      a value from the request. Gate: `bun run test` (`functions` project)
- [x] 2.2 `preferences-document.mts`: the shape the endpoint will accept, and its
      own bound
- [x] 2.3 `netlify/functions/preferences.mts`, and both endpoints served under
      `bun run dev`. Gate: `bun run csp` still emits `connect-src 'self' …` with
      no origin added

## 3. The browser

- [x] 3.1 `model/ports.ts` and `api/preferences-gateway.ts` over HTTP, with the
      bounded retry that makes last-write-wins out of a conditional write
- [x] 3.2 `lib/use-preferences-sync.ts`: read once, reconcile, write through on
      change, debounced
- [x] 3.3 `PreferencesProvider` takes the gateway optionally, so a test and the
      not-configured screen have none and nothing waits
- [x] 3.4 The settings screen says when the settings are not being synced

## 4. Tests

- [x] 4.1 Handler tests for the new document, including that one reader's key
      cannot reach the other's
- [x] 4.2 Provider tests: paints local before the store answers, adopts a newer
      remote, pushes a newer local, survives a store that refuses
- [x] 4.3 Acceptance: a setting made in one visit is in effect after the device
      forgets its local copy. Gate: `bun run arch:trace`

## 5. The written record

- [x] 5.1 `AGENTS.md`: what is synced, what is not, and why the reconciliation
      differs from the teams document
- [x] 5.2 `README.md` and `docs/qa/regression-checklist.md`

## 6. Every gate

- [x] 6.1 `bun run verify && bun run test`
- [x] 6.2 `bun run test:coverage`, `bun run test:mutation`, `bun run test:e2e`
- [x] 6.3 `bun run build && bun run size`
- [x] 6.4 `bunx openspec validate --all --strict`

## 7. What the review found after the fact

Every item below is a defect an adversarial pass caught that no gate could, and
each is fixed with a test that fails without the fix.

- [x] 7.1 A write outlives the value that started it: the answer is reconciled
      against what the device holds **now**, so an edit made while a write was in
      flight is neither reverted nor swallowed
- [x] 7.2 A refusal is a rejection, not an empty document — a `503` used to read
      as "the store has never heard of you" and the reader was told they were
      synced
- [x] 7.3 An undated document is never sent. The endpoint refuses one, and
      reporting that refusal would tell a reader who had just arrived that their
      settings were stuck; the first publication is stamped instead
- [x] 7.4 `preferences-contract.test.mts`, holding the browser's codec against
      the endpoint's validator, which is what would have caught 7.3 at the
      boundary rather than in production
- [x] 7.5 The dev middleware builds its request URL from the endpoint's path
      rather than from the key suffix
- [x] 7.6 The written record: `AGENTS.md`, `README.md`, `netlify.toml`, the
      settings copy in both catalogues, the test plan, the metrics table, the
      traceability gate's own excuse text, and this capability's purpose — each
      of which still described one endpoint, or settings that never leave the
      device
- [x] 7.7 `document-endpoint.mts`: the fifty lines both functions were, shared —
      the configuration read, the key discovery and its cache, the 503 — with a
      test for the rule the copy held and neither file proved, that a failed
      discovery is not remembered. `config/vite/api-dev.ts` was a third copy and
      runs the same body now
