## Why

The dashboard decides for itself when to ask GitLab for hours: five minutes of
freshness, then a refetch on the next mount. That is right for the ordinary
visit and wrong for the one that matters most — the reader has just logged time
in GitLab, switches to this tab, and the figures are the ones from four minutes
ago. There is nothing on screen to say so and nothing to press.

The screen already knows both halves of the answer. TanStack Query records when
each successful response arrived and can be asked for another one; the report
already exposes whether a request is in flight. What is missing is the control
that turns that into something the reader can see and act on: when the hours on
screen last came from GitLab, and a way to ask for them again now.

## What Changes

- A sync control appears on every screen that reads hours — the dashboard,
  insights and a day. It is an icon button that asks GitLab for the loaded
  history again, with the state of the report written beside it.
- While a request is in flight the icon turns and the control says the hours are
  being updated. Otherwise it says when they last arrived, as a time of day, or
  as a date and a time when that was not today.
- A failure is reported in the same place as before, and the sync control is now
  the retry: one control for "ask GitLab again", whether the last attempt failed
  or merely grew old. The separate "Try again" button is removed.
- `ReportNotice` is replaced by `SyncControl`, which owns all four states —
  never synced, syncing, synced at a time, and failed.

## Capabilities

### Modified Capabilities

- `dashboard-ui`: gains the sync control and the last-sync time. No other
  capability changes; the report itself already supported refetching.
