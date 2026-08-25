## Context

The report is one infinite query under one key (`['timelogs', 'mine']`), shared
by the dashboard, insights and the day screen. Everything this change needs is
already held there: `dataUpdatedAt` is the instant of the last successful
response, `isFetching` covers any request over that key, and `refetch()` asks for
every loaded page again. So this is a presentation change, not a data one — no
new query, no new cache entry, no change to the gateway.

## Goals / Non-Goals

**Goals:**

- One control that answers "are these figures current?" and "get me current
  ones", without the reader having to reload the page.
- A last-sync time that survives a return visit, because it is part of what the
  persister already writes.
- One live region per screen, so a screen reader hears one status rather than
  competing ones.

**Non-Goals:**

- Polling or a live subscription. GitLab has no push for timelogs, and a timer
  that refetches behind the reader spends their rate limit on a screen they may
  not be looking at.
- A relative time that counts up ("3 minutes ago"). It reads well and needs a
  ticking interval per screen to stay true; a clock time is exact, and the
  reader already knows what time it is.

## Decisions

### 1. `SyncControl` replaces `ReportNotice`, rather than sitting beside it

Two components would mean two `role="status"` regions on one screen — two things
a screen reader announces on the same event, and an ambiguous `getByRole` in
every test that asks for the status. One component owns all four states: never
synced, syncing, synced at a time, and failed.

That also settles the retry. `ReportNotice` carried its own "Try again" button;
keeping it would put two buttons that make the same request on the same screen.
The sync control is the retry, and `report_retry` is removed from both message
catalogues.

### 2. The status text sits before the button, and the button is pinned to the end

The text changes length as the state changes — "Updating…" is half the width of
"Updated 21 Aug at 14:32". With the button first, every change would move the
button under the reader's pointer. Text first, in a cluster pushed to the end of
the header, means the text grows leftwards into empty space and the control
never moves. `UI-9` (loading does not move the page) is asserted on the
dashboard, and this is the shape that keeps it true.

### 3. The time is formatted through `Intl`, in the configured zone

`formatTimeOfDay` takes the instant, the locale and the reader's time zone
preference, and `formatShortDate` names the day when the sync was not today.
Both go through the same cached-formatter machinery as the rest of
`shared/lib/format`, for the reason recorded there: constructing an `Intl`
formatter costs more than formatting with one.

Whether the sync was "today" is decided with `toIsoDate` in the same zone — the
one place an instant becomes a calendar day — so a sync at 23:30 in São Paulo is
not called yesterday because UTC has already rolled over.

### 4. The button stays enabled while a request is in flight

Disabling it would blur it, which takes focus away from a keyboard reader at the
exact moment they pressed it. TanStack Query already dedupes a refetch over a
query that is fetching, so a second press costs nothing. The turning icon and
the text carry the state instead, and the icon turns under `motion-safe:` only —
for a reader who has asked for reduced motion, the text is the feedback.
