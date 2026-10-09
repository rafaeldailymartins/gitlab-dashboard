# Document endpoints: decisions that will look wrong until you know why

Moved out of `AGENTS.md` so that they load where they apply: a `CLAUDE.md` in
`netlify/`, `src/entities/preferences/` and `src/entities/teams/` imports this
file. The rule they were written under still holds: each was tried the obvious
way first and changed on evidence, and reverting one without reading the
reason will reintroduce a bug that is already fixed. The OAuth scope and its
deployment order stay in `AGENTS.md`, because they break every sign-in rather
than these endpoints alone.

- **There is a backend now, and it is two functions over one handler on this
  origin.** `netlify/functions/{teams,preferences}.mts` over Netlify Blobs. Same origin is the whole
  reason the store is Netlify's rather than a database elsewhere: the app's
  `connect-src 'self'` already reaches it, so there is no CSP change, no CORS
  preflight and no allow-list to keep right. It authenticates from the
  `Authorization` header and from nothing else — no cookie, no session, no
  `Origin` check — and emits no CORS headers at all, which is what makes it
  CSRF-exempt rather than CSRF-lucky: a cross-site form cannot set that header,
  and a cross-site `fetch` that does triggers a preflight this will not answer.
  Adding a cookie credential or a permissive CORS header would quietly undo that.
  Identity is a GitLab OIDC `id_token`, verified offline against JWKS with
  `jose`: `RS256` named rather than inferred, because letting the token choose
  the algorithm is how algorithm confusion gets in; discovery refused unless the
  key endpoint is on the provider's own origin; and `maxTokenAge` bounding replay
  independently of whatever `exp` claims. The token is minted on demand through
  the same single renewal a burst of requests already shares, and never written
  to storage. The only thing that leaves the verifier is a subject — the `openid`
  scope also puts `email` and `groups_direct` in that token, and the `Identity`
  return type is what keeps them from reaching anything else.
- **The storage key is derived from the verified subject, so IDOR is not
  expressible.** `v1/${sub}/teams` and `v1/${sub}/preferences`, in a store named
  `readers` — production's; every other deploy's is `readers-staging`, below —
  where `sub` comes from the signature and from nothing the request
  carried — no path parameter, no body field, no header. The
  difference from checking an id against the caller is that there is no check to
  forget: naming another reader's teams is not a request this endpoint can
  refuse, because it is not a request it can represent. A write carries the
  version it was made against, in `x-document-version` — the etag, or `*` for a
  first write — and one carrying neither is refused **428** rather than
  accepted, because a `PUT` with no precondition is a client that never read,
  and the silent clobber is the failure mode a last-write-wins store has.
  **The store names the partition and every document names itself**, and both
  halves of that are corrections. The store was `teams`, which stopped being
  true the day the reader's settings moved in beside them; it is `readers` now,
  because the top level of every key is one reader and a name describing the
  partition cannot go stale when a third document arrives. Not `users` or
  `accounts`: those claim the store holds an identity, and it holds a subject
  and nothing else, which is what `Identity` exists to enforce — the documents
  themselves hold a great deal, and README.md says so. And the teams document's
  suffix was empty: it was the first thing stored and took the reader's key
  unqualified, which left the teams key a _prefix_ of the preferences key. A
  `list({ prefix })` over `v1/${sub}` would have returned both and read one
  reader's teams as a folder holding their settings, and a subject of
  `X/preferences` would have composed to exactly the key subject `X` files
  theirs under. Neither could happen — `DocumentStore` offers only `read` and
  `write`, and `USABLE_SUBJECT` refuses `/` — but both were refused by a regex
  and an absent feature rather than by the shape, and both of those are things
  somebody widens. With every document named there is no subject and no suffix
  that compose to another pair's key at all.
  **Changing any of this moves nothing.** A deploy simply starts reading a key
  that is not there, and a missing key is indistinguishable from a reader who
  has never saved — no error, no null anybody sees, just an empty screen where
  a roster was. It is the same hazard as the Blobs region `blob-store.mts` pins, and it was taken here
  deliberately: the store is being emptied rather than migrated, because nobody
  had stored anything worth keeping yet. A later change does not have that
  option, and `docs/qa/release-checklist.md` carries it under rollback.
  `handle-document.test.mts` pins the key each document lands on and the
  no-key-inside-another invariant over the set, because the whole of this used
  to be asserted in prose: setting the suffix back to `''` passed the entire
  suite, including the test next door that proves the two documents do not
  overwrite each other — `v1/1` and `v1/1/preferences` are distinct keys too,
  so equality was never the property at risk.
  **It is not `If-Match` and `If-None-Match`, which is what it was and where
  the semantics come from.** Those never reached the function on a deployed
  site: Netlify's CDN uses the `If-*` headers for its own conditional requests
  and consumes them on the way through, so every write was refused 428 —
  correctly, and uselessly. Nothing could see it, because the three places that
  exercise a write have no CDN in them: the `functions` project calls the
  handler directly, the acceptance suite route-stubs the endpoint, and
  `bun run dev` is a Vite middleware. The header is declared on both sides,
  since `netlify/` must not import from `src/` at run time, and
  `handle-document.test.mts` holds the two spellings against each other. The
  instrument that can see the path itself is a deploy, and
  `docs/qa/release-checklist.md` now reads the request rather than the result.
  **And it is not `ETag` on the way back, for the same kind of reason.** The
  version returned as `ETag`, which the CDN rewrites when it compresses a
  response: `"8c97…208"` reached the browser as `"8c97…208-df"`, the reader
  handed that back, and it named nothing stored — so every save after a
  reader's first was refused as "changed somewhere else", and settings stopped
  syncing without a word. It survived a release checklist that read the `PUT`,
  because every first write goes out as `*`: only a second save takes this
  path, and the first second save anybody made was in production. The answer
  carries `x-document-version` now and no `ETag` at all, so there is no
  corrupted copy for a client to read, and the checklist saves twice. A header
  HTTP defines is a header the path between here and the browser acts on;
  every header this protocol needs is one of its own. `DocumentStore` is a port for
  the same reason: those rules are the part worth testing, and the acceptance
  suite serves a static `dist/` with `vite preview`, which runs no function — so
  the `functions` Vitest project is the only place they are proved.
- **The store follows the deploy, and a deploy that cannot say which it is gets
  none.** `netlify/lib/store-name.mts` (DELIVERY-1): `production` files readers'
  documents under `readers`; `branch-deploy`, `deploy-preview` and `dev` under
  `readers-staging`; anything else answers `503 store-unavailable` before a key
  is fetched or a store is asked. Homologation is where something broken is tried
  on purpose, and a roster is a list of colleagues, so the two must not be able
  to reach each other's documents — before this, every preview wrote to
  production's store.
  The context comes from the function's second argument,
  `context.deploy.context`, because there is nothing else at run time: `CONTEXT`
  is a build-time variable, and a function is given only `URL`, `SITE_NAME` and
  `SITE_ID`. A per-context variable set in the Netlify UI was the alternative,
  and it is a second place the rule lives, silent when missing.
  **Refusing is the point, not a gap.** Defaulting to production lets a misread
  homologation deploy write over readers' documents in silence; defaulting to
  homologation shows every reader in production an empty list of teams they did
  make. A refusal is loud both ways, and the release checklist reads
  production's teams straight after a deploy, which is where a value the
  platform changed would show.
  `readers` keeps its name for the reason the key paragraph above gives:
  changing it moves nothing. And a bundle from before this names `readers` on
  every deploy, so reverting it onto `staging` is homologation writing to
  production — `docs/qa/release-checklist.md` says to turn staging's branch
  deploys off first.
- **Two of the four settings follow the reader; two stay on the device.** The
  daily target and the time zone are facts about the _person_ — they decide what
  a full day is and which calendar day an entry lands on — so they are kept in
  the reader's own store beside their teams, under `v1/${sub}/preferences`. The
  colour scheme and the language are facts about the _machine_, and the theme is
  applied by an inline script **before the first paint**, which a value fetched
  over the network cannot be.
  That distinction stopped being cosmetic when the team table began measuring its
  bars against the daily target: the same month drew different bars on two
  laptops belonging to one person, and a report whose shape depends on which
  machine is open is a report nobody can quote.
  **The device is still the read path.** `useStoredValue` reads `localStorage`
  synchronously on the first render, so no screen gained a skeleton and no query
  was introduced. The store is a second opinion that arrives afterwards and can
  only ever replace what is on screen with something the same reader wrote more
  recently somewhere else.
  **Reconciliation is last write wins on a recorded instant, and that is
  deliberately not how a team is reconciled.** A roster is edited by somebody
  watching it, so a stale write there is refused and reported — losing a
  colleague silently is the worst thing that surface can do. Settings change in
  the background, one field at a time, from a form nobody is waiting on for a
  verdict; what a race costs is one number the reader can see and set again, and
  a dialog about it would be a dialog over nothing.
  The endpoint's discipline is **not** weakened to get that. It still refuses a
  write naming the wrong version and still refuses one naming none. Last-write-
  wins is a _client policy_ in one bounded retry, in
  `api/preferences-gateway.ts`: on a conflict, compare the instants; theirs is
  newer, adopt it; ours is newer, write once more against the version we were
  just handed; a second conflict is read rather than retried, which terminates
  and gives the same answer.
  `updatedAt` lives on the envelope, never on `Preferences`. No screen reading a
  target has any business with when it was set, and the instant is stamped in the
  provider because the model may not reach for a clock. A document with no
  readable instant carries **null**, and a device holding one does not compete:
  it adopts whatever the store has, and pushes only against a store that holds
  nothing at all. Both halves are load-bearing and they are not symmetric.
  Adopting is what stops a fresh install — defaults, nothing recorded — from
  pushing those defaults over settings the reader really set on another machine.
  Pushing against an empty store is what carries settings a device was already
  holding before any of this existed, without waiting for the reader to touch a
  field. That push is **stamped on its way out, and an undated document is never
  sent at all** — the endpoint refuses one, because nothing could order it
  against another device's, so sending it would report a failure to a reader who
  had just arrived and set nothing. It shipped that way for an afternoon and no
  gate saw it: the gateway test asserts what goes out, the handler test asserts
  what a well-formed request gets back, and neither is where the two shapes meet.
  `netlify/lib/preferences-contract.test.mts` is that place now.
  It was an epoch date first, exactly as an unreadable team is, and that
  said "1970" about a document nobody dated: two devices that had both never
  recorded an instant then agreed with each other while holding different
  settings, so neither adopted and the two drifted apart in silence. A reader can
  still lose a setting they can see, but only to an instant — the other device
  wrote later, which is the whole rule.
  A store that will not answer costs nothing but the syncing. The values the
  reader set are in effect — written to the device before anything was sent —
  and `/settings` says in one quiet line that they are not being carried. It is
  said there and nowhere else: a setting that silently stops following somebody
  is found out months later, on the wrong figure.
- **One handler serves both documents, and one endpoint body serves both
  functions.** `handle-document.mts` is parameterised by the key suffix it
  appends, the document it parses and the size it accepts;
  `document-endpoint.mts` is everything in front of it — the configuration read,
  the key discovery and its cache, the 503 that says only that identity could
  not be established — so `netlify/functions/{teams,preferences}.mts` are one call
  each, naming a document and a path. They were fifty lines each and
  identical, and the copy held the least obvious rule of the three: a **failed**
  discovery must not be cached, or one bad minute outlasts itself for the whole
  life of the instance. `config/vite/api-dev.ts` was a third copy, and a worse
  one — it discovered on every request. It runs the same body now, with the
  memory store passed in, so what is left in it is the translation between what
  Vite hands a middleware and what a function is called with. The security
  property is unchanged and worth restating, because a refactor is where it could
  quietly be lost: **the suffix is a constant a function module chooses, never a
  value read from the request.** `v1/${sub}/teams` and `v1/${sub}/preferences`
  are both derived from a subject the signature established and from nothing a
  caller sent, so addressing another reader's anything stays inexpressible rather
  than refused. Duplicating sixty lines of credential handling into a second module
  was the alternative and is worse: two copies are two places to fix a rule, and
  the second is the one somebody forgets. `config/vite/api-dev.ts` serves both
  under one store for the same reason the deployed ones share one — a suffix that
  was not distinct would have the two documents overwriting each other, and each
  would look perfectly well-formed on its own.
