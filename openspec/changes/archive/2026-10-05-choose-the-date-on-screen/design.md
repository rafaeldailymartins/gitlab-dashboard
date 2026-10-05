# Design

## 1. A day on the dashboard, a month on insights

The two screens are built around different units, and the control follows the
unit rather than being one control pasted on both.

The dashboard is three periods _around a day_ — the day, its week, its month —
plus the week's shape and the history before it. What a reader moves is the day,
and the other two follow. A range picker would have to answer what "this week"
means for a range of nineteen days, and the honest answer is that the screen
would stop being the dashboard.

Insights is a month: the heatmap is a calendar month by construction, and the
split and the table are "where did this month go". What a reader moves is the
month.

## 2. The choice is in the address, and its absence means the clock

`/?date=YYYY-MM-DD` and `/insights?month=YYYY-MM`, both optional. This is the
team screen's argument — what you are looking at is what you can send — with one
difference, and it is deliberate: an address with no choice is **not** completed
by a redirect. The team screen completes an empty team because a team has no
default worth keeping implicit. Here the default is "now", and writing today's
date into the address would freeze it: a bookmark of the dashboard would open on
the day it was saved. So absence is a value of its own, and it keeps meaning
today as midnight passes. Choosing today in the control navigates to the
address with no parameter, so there is one address for "now" rather than two.

The parameters are validated by the routes and nothing there throws: a value
that is not a real calendar date or month is dropped, as if it were absent. The
parsing lives in `shared/lib/address.ts` rather than beside the pages, because a
route's `validateSearch` is not code-split and importing it from a page's public
API would put that whole page in the initial load. A
day or month **after** today is clamped to today at render, not in the route,
because "today" is a fact about the reader's time zone and the zone is only
known inside React. The route could resolve it in UTC, as the team screen does
for its fallback month, but there it only decides which month the screen opens
on; here it would decide whether a perfectly good date in São Paulo is rejected
for being tomorrow in UTC.

Neither choice is remembered across visits. The default is the right answer to
the question a reader most often opens these screens with, and a remembered past
date would greet them with last month's figures under a heading they would have
to read to notice — the same reason the team screen's group filter is not
remembered.

## 3. One history, settled further back

There is no new request and no new query key. The history is read newest first
into one cache entry, and every period is cut from it locally; an earlier period
is the same cut over a different range.

What changes is how far back the report insists on reading. `useHoursReport`
already keeps asking for older pages while the month is unsettled (REPORT-3). It
now takes the day the screen is about and settles that day's periods rather than
today's. The rule naming them is pure and lives in `entities/timelogs/model`:
`periodsOf(day)` answers the day, its Monday-to-Sunday week and its calendar
month, and the report keeps reading until both the week and the month are
settled.

Both, not the month alone, and that corrects something that was already there:
a week that began in the previous month starts before the month does, and the
month being settled said nothing about it. On 2 October 2026 the week starts on
28 September, so a first page reaching back to 30 September settled the month
and left the week a floor forever — saying "still loading" with nothing loading.

Reading back to a chosen period is not the eager, fixed-window retrieval
REPORT-6 forbids: it is retrieval the reader asked for by choosing the period,
and it stops at that period's start.

## 4. Not yet read is not nothing

A period the report has not reached would otherwise draw as empty: a week strip
of seven zero bars, a heatmap of dashed "nothing logged" squares, a day screen
saying no time was logged. Each is the claim UI-7 forbids. So the week strip
waits on the week being settled, insights waits on the month, and the day screen
waits on the day. The period figures already say "still loading" while
unsettled, and keep doing so.

The feed begins at the chosen day by filtering the loaded days. When that leaves
nothing and history continues, the feed shows its loading rows and its footer
rather than "No time logged in GitLab yet", which would be false; the footer's
own approach-loading then reads further back, as it does at the end of any feed.

## 5. The controls

The day control is a stepper — the day before, the day on screen, the day after
— in the same bordered strip as the month stepper on the team screen, and the
day in the middle opens a calendar in a popover: `shared/ui/calendar.tsx`
(shadcn's, over `@daypicker/react`) inside `shared/ui/popover.tsx`, the same
kind of panel the report's pickers open.

It began as the platform's `<input type="date">`, on the argument `/settings`
makes for its native selects, and was replaced on review. The native field
writes the date in the _browser's_ locale, so an English screen on a Brazilian
machine read 02/10/2026, and it drew an operating-system control among the
app's own. The trigger names the day through `Intl` in the app's language with
its year (`2 de out. de 2026`), and every string the calendar shows or
announces comes from `Intl` and Paraglide, because its defaults are date-fns'
English. The replacement also removed a debounce: typed into, a date input
reports a complete date after every segment, so the year 2025 passed through
0002 on the way, and each was an instruction to read the history back to it. A
click on a day is one complete choice, so it commits and closes at once.

The calendar is handed every day as UTC midnight and reads its answer back with
`toIsoDate(date, 'UTC')`, so a picked square is a calendar date and nothing
crosses a zone; "today" in it is the reader's today, handed over the same way.
Days after today are disabled, and it cannot page past the current month.

The picker is `lazy()`, with a skeleton of the trigger's exact size standing in
while it loads. The dashboard is the first screen, the initial load has two
kilobytes left in its budget, and the team screen measured the popup machinery
hoisting 34 kB into the entry when imported eagerly.

The controls that would go past today are disabled but stay focusable, so a
keyboard reader stepping forward onto today keeps focus where they pressed. The
"today" and "current month" buttons are always present and disabled when the
screen is already there, rather than appearing and disappearing, so the row
never shifts under the reader (UI-9).

The month control is a stepper around the month's name, as on the team screen.
`<input type="month">` was the obvious alternative and is not usable: desktop
Firefox and Safari render it as a plain text box.

Both carry a way back — "Back to today", "Back to the current month" — so the
way back from anywhere is one press.

The labels of the period figures follow the day. When it is today they are
"Today", "This week" and "This month", unchanged. Otherwise they name their
dates — the day, "Week of" its Monday, the month — because "This week" over a
week in August is false, and a generic "Week" makes the reader look up at the
heading to learn which one.
