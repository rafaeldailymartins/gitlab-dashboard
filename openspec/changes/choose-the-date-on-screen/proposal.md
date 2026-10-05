# The dashboard and insights can be read for a date the reader chooses

## Why

Both personal screens answer about **now** and nothing else. The dashboard
summarises today, this week and this month; insights draws this month. A reader
who wants to know how last Tuesday went, or what August went into, has no way to
ask: the history feed reaches back, but it is a list of days, and the figures
that make the screen worth opening — the period totals against their targets,
the week's shape, the month's gaps, the split by project — exist only for the
present.

The history is already read newest first and every period is already cut
locally, so nothing about the data stops an earlier period from being answered.
What is missing is the question.

## What changes

- The dashboard gains a **day** control: the day before, the day itself — which
  opens a calendar — the day after, and a way back to today. Everything on the screen follows the chosen
  day — the heading, the three period figures (that day, its week, its month,
  each against its target), the week strip, and the history feed, which starts
  at that day.
- Insights gains a **month** control: the month before, the month on screen,
  the month after, and a way back to the current month. The heatmap, the split
  by project and the table of work items all follow it.
- Both choices live in the **address** — `/?date=YYYY-MM-DD` and
  `/insights?month=YYYY-MM` — so a reload keeps them and a link carries them. An
  address with no choice means today, and keeps meaning today as the clock moves.
  An address that names something that is not a date, or a date after today,
  falls back to today rather than failing.
- Choosing a period before what is loaded keeps reading history until that
  period is settled, exactly as the current month already does (REPORT-3). The
  figures say they are still loading meanwhile, and the week strip, the heatmap
  and the day screen show loading rather than zero for days not yet read.
- The day screen reached by an address is settled the same way, so reloading an
  old day no longer shows it as empty.

## Impact

- Specs: `dashboard-ui` gains UI-17 and UI-18 and modifies UI-1, UI-2 and UI-5;
  `personal-timelog-report` modifies REPORT-3.
- Code: `entities/timelogs` gains the pure rule naming the periods around a day;
  `widgets/hours-report` settles the periods of the day it is given rather than
  of today; `pages/dashboard` and `pages/insights` gain their controls and the
  parsing of their addresses; the two routes validate their search parameters.
- No new request shape, no new query key, nothing persisted: one history, one
  cache entry, cut differently.
