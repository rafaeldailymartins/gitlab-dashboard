# The initial load is budgeted at 196 kB

## Why

Dependabot's runtime group cannot merge. React 19.2.8 → 19.3.0 adds 8.6 kB
gzip to the initial load and zod 4.4.3 → 4.6.5 adds 6.4 kB, so the files
`index.html` requests come to 195.55 kB against a budget of 180 kB that the
page had already filled to 179.53 kB. Each figure was measured by reverting that
package alone on the group's branch and building again.

There were three ways forward: hold both packages back, take them and cut
sixteen kilobytes elsewhere, or move the budget. The owner chose to move it.
Holding React and zod back would make every later security or bug-fix release
of either a decision about bytes; finding sixteen kilobytes is a project of its
own, with no promise it fits.

## What changes

- **OBS-5's budget goes from 180 kB to 196 kB gzip**, measured as it is today:
  every file `index.html` requests, the entry, its preloads and the stylesheet.
  Everything else OBS-5 says — no reporting code in the first load, reporting
  fetched when the page is idle — is unchanged.
- `.size-limit.js` enforces the new figure, and says why it moved.
- The places that state the budget as a current fact follow: `AGENTS.md`'s
  commands table, both READMEs, `docs/qa/quality-metrics.md` and
  `docs/qa/release-checklist.md`. Measurements recorded against the old budget —
  why the pickers are `lazy()`, why the address parsers live in `shared` — stay
  as they were measured, against 180 kB.
- In the same pull request, and with no requirement behind it: TanStack Query
  5.104 deprecates `QueryClient.fetchQuery` in favour of `query`, and the lint
  gate refuses the deprecated call, so the one use in `src/` and the two in its
  tests move to `query`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `observability`: OBS-5's budget for the initial load, 180 kB → 196 kB.

## Impact

- **Readers**: the first visit downloads up to sixteen kilobytes more, gzip.
  Return visits are served from cache as before.
- **Headroom**: 0.45 kB at 196 kB. The next addition to the first load meets
  the gate again, which is the point of having one.
- **Code**: `.size-limit.js`, `src/widgets/team-manager/lib/use-group-seeding.ts`
  and `src/shared/api/query-client.test.ts`, plus the documents above. No
  behaviour a reader can see changes.
