## Why

The previous dashboard was single-tenant by construction: it read one Personal
Access Token from a `.env` file, so nobody but its owner could use it and
rotating the token meant editing a file on disk. It was also slow for a
structural reason. Every page load resolved the configured group, then walked
_the entire group's_ timelogs through up to 20 sequential paginated GraphQL
requests, and only afterwards filtered them down to one person in memory —
narrowing to a single user did not reduce any of that work. Finally, it showed a
multi-user aggregate table, which is not what a person checking their own hours
wants to look at.

Three facts verified against the live GitLab API make a much better product
possible. `currentUser.timelogs` scopes the query to the signed-in user
server-side, so nobody else's entries are ever fetched. It can be read
newest first with no date window at all, so one request of a hundred entries
answers today, this week and this month — its `startDate`/`endDate` arguments are
truncated to UTC calendar dates and would not line up with the reader's own days,
which is why periods are cut locally instead. And GitLab answers both
`POST /oauth/token` and `POST /api/graphql` with permissive CORS headers, so a
browser can complete an OAuth exchange and query the API with no server in
between.

Together those remove the token, the backend and the latency at once.

## What Changes

- **BREAKING**: the app no longer reads `GITLAB_TOKEN`, `GITLAB_GROUP_PATH`,
  `GITLAB_PROJECT_PATH` or any server-side configuration. It is configured by a
  single public OAuth client id.
- **BREAKING**: the server is removed. The app becomes a static bundle; there is
  no server function, no runtime secret and no database.
- Users sign in with their own GitLab account through OAuth 2.0 Authorization
  Code with PKCE, requesting the read-only `read_api` scope.
- The report is scoped to the signed-in user and is no longer restricted to one
  configured group or project: it covers every project the user logged time in.
- Period totals are accumulated in seconds from the entries actually retrieved,
  so a total always equals the sum of the days shown for it, and a period the
  loaded history does not reach back to is reported as unsettled rather than as
  final.
- History is paged on demand with a cursor instead of eagerly fetching a fixed
  window, and the query cache is persisted so a return visit renders before any
  request resolves.
- The screen is rebuilt around one person: a week strip measured against a daily
  target, totals for today, the week and the month, and a day-by-day feed that
  opens into the issues and merge requests worked on.
- The interface is available in English and Brazilian Portuguese, and in light
  and dark themes.
- Removed for now: the aggregated view across users. A group-level view is a
  later, separate change.

## Capabilities

### New Capabilities

- `gitlab-authentication`: signing in with a GitLab account, holding and
  refreshing the resulting tokens, and signing out.
- `personal-timelog-report`: retrieving the signed-in user's timelogs for a
  period and turning them into per-day and per-work-item totals.
- `dashboard-ui`: the screens that present those totals — week strip, period
  totals, day feed, day detail and insights.
- `localization`: presenting every user-facing string, date and number in the
  reader's chosen language.
- `user-preferences`: the settings that change how figures are computed and
  presented — daily target, time zone, language and theme — and their
  persistence across visits.

### Modified Capabilities

None. This is the first change in a re-initialised OpenSpec project; there are
no existing specs to modify.

## Impact

- **Everything under `src/`** is new. The previous implementation was removed on
  this branch in `chore: remove v1 implementation`; it remains on `main`.
- **Deployment** changes from a running server to static files on Netlify, with
  a SPA fallback so `/auth/callback` and deep links resolve.
- **Manual setup**, once, by each user: create a non-confidential OAuth
  application in their own GitLab account settings with the `read_api` scope and
  the app's `/auth/callback` redirect URIs. No administrator is involved.
- **Security posture** changes shape rather than degrading: a long-lived
  personal token in a file is replaced by a read-only, two-hour access token
  held in memory, plus a rotating refresh token in `localStorage`.
- **No new runtime dependency** is introduced for authentication or data access:
  the OAuth exchange and the GraphQL calls use `fetch`.
