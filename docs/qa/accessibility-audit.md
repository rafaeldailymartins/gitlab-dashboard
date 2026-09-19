# Accessibility audit

The automated checks in this repository are `axe-core` on every route in both
colour schemes, `jsx-a11y` in the strict configuration, and Biome's ARIA rules.
Between them they catch structure. They do not catch experience, and this project
has already been bitten by the difference.

**Read this first.** Four screens gave their hour figures an `aria-label` on a
`<span>`. ARIA prohibits naming a generic element, so every screen reader ignored
the label and read "6.7 h" as a number and a letter. The lines were covered by
tests, the tests asserted `getByLabelText('6.7 hours')` and passed — Testing
Library computes an accessible name whether or not the platform would — and both
`jsx-a11y` and axe let it through. A static ARIA rule found it. Nothing else
would have, short of listening to the page.

So: run the manual pass. It is short.

## Keyboard, before anything else

The acceptance suite already walks the tab order and asserts a focus indicator is
drawn at every stop. What it cannot judge is whether the order makes sense.

1. Load `/` signed out. There is no header: the sign-in screen owns its own tab
   order, and it should be the sign-in button first, then the colour-scheme
   control. The decorative week is skipped entirely — if Tab stops on a bar, a
   focusable element has been added inside an `aria-hidden` subtree, which is a
   WCAG 4.1.2 failure axe will also report.
2. Load the dashboard and press Tab from the top. The order should be: skip
   nothing, header, navigation, colour scheme, sign out, week strip left to
   right, then the feed newest first.
3. On a day row, press Enter. It expands. Press Enter again: it collapses.
4. Tab into an expanded day. The issue links come next, in the order shown.
5. On `/insights`, Tab to a table header and press Enter. The sort changes, and
   focus stays on the header rather than jumping to the top of the table.
6. Nowhere should Tab reach something invisible, and nowhere should it skip
   something visible.

## With a screen reader

Use one of NVDA + Firefox on Windows, or VoiceOver + Safari on macOS. Both if the
interface structure has changed.

### The dashboard

1. Read the page from the top with the reading cursor. The heading should give
   the date; the status line should say whether the report is current.
2. Move by heading. There should be one level-1 heading and one level-2 per
   section — "This week", "History" — and nothing announced twice.
3. Reach the summary. Each figure should read as its label and then its hours
   **spoken as hours**: "This week, 7.7 hours". If you hear "seven point seven h",
   the hour figure has regressed to reading its digits.
4. Reach the week strip. Each bar should announce its weekday, its hours and its
   target — "Wed: 7.5 hours of a 8 hour target" — or say it has no target. Today
   should be announced as current.
5. Reach the feed. Each day should announce its date, its weekday and its hours,
   and whether it is expanded.
6. Expand a day. The work items should be announced as a list, each with its
   hours, its title and that its link opens in a new tab.

### Insights

7. The month grid is a wall of squares. Each should announce its full date and
   its hours, and a working day with nothing logged should say so. Confirm the
   ones outside the month announce nothing at all rather than "0 hours".
8. The project split should read its project name and hours as text. The colour
   carries nothing.
9. The table should be announced as a table with a header row, and the sort state
   of the sorted column should be audible.

### The team report

The matrix is the only two-dimensional table in the app, and the only place the
reader's own screen-reader table keys — `Ctrl+Alt+arrows` in NVDA and JAWS,
`VO+arrows` in VoiceOver — are the intended way to read. Everything below is
about whether they work, which no automated check can tell us.

Two facts about the report decide what a cell is allowed to say, so arrange them
before starting. The rows are the reader's own team and nothing else: everybody
they put on it keeps a row, including somebody who logged nothing, because the
reader picked them and an empty row is the answer they came for. And the figures
reach every hour GitLab will show this reader — personal projects included —
unless the group filter narrows them. The filter is empty by default and it is
the one control that changes the spoken text below, so steps 14 and 15 are the
same cell read twice.

10. Tab to the table. The scroll region should take focus, draw a visible ring,
    and scroll with the arrow keys.
11. Move right across a row with the table keys. Each move should announce the
    day and the hours — and should **not** re-announce the person. Hearing the
    name on all thirty-one cells is the failure this is looking for.
12. Move down a column. Each move should announce the person and not repeat the
    date.
13. Enter a new week. Confirm the band above is announced, or at minimum not
    misattributed to the wrong columns. Support for a spanning column header is
    uneven; the week is also in each day heading's spoken text, so the band is an
    enhancement rather than the only carrier.
14. With the filter empty, find a working day nobody logged. It should say "No
    hours logged anywhere." That is the strongest claim this screen makes,
    and it is only available here: nothing narrowed the question, so nothing
    was left out of the answer.
15. Narrow to a group and read the same cell again. It should now say "No hours
    in this group." Nothing visible changes between this step and the last — the
    dash is the same dash — so a listener is the only instrument that can tell
    the two claims apart. A cell still saying "anywhere" under a named group
    is a statement about somebody's whole month made from a measurement of one
    group.
16. Find a Saturday. It should say nothing beyond its column heading —
    absence of expectation is not a fact worth announcing thirty-one times.
17. Read a row for somebody GitLab would not resolve: an account that has
    since been blocked or deleted, or one this reader cannot see. The row
    header should give the name the reader last saw and then "GitLab did not
    recognise @<handle>", and every cell in it should say "Nothing is known
    about this person." rather than an absence — a dash there would read as a
    month they did not work. `grep -rn unresolved features/` returns nothing,
    so no scenario in any browser reaches this state and this step is its only
    coverage.
18. Activate the Person and Total headings. The ordering should be audible, and
    should change when the same heading is activated again.
19. Confirm no data cell is a tab stop: Tab from the last control should leave
    the table entirely rather than walking a thousand cells.
20. Find a row with hours held back. The shortfall should be spoken as part of
    that row, after its total, as "+N h hidden" — not only in the status region.
    Expect to find one: an unnarrowed read reaches every issue the provider will
    show this reader, so an issue it will not show is the ordinary case rather
    than the Guest-in-a-group edge case this step used to describe. A month with
    no short row at all is likelier a broken probe than a transparent instance.
21. On a row where the provider counted entries and handed none of them over,
    the name should carry "Hours you cannot read" and every empty working day
    should say that nothing there is readable rather than that nothing was
    logged. Check that sentence against the filter: with the filter empty, one
    that names a group is naming something the reader never asked about.

### Teams

The screen at `/teams`, reached from the report and from a card on `/settings`.
It is a screen rather than a dialog, so this pass addresses it by URL like every
other one.

22. Move by heading. There should be one level-1 heading, "Teams", and four
    level-2 ones: the list of teams (spoken, not drawn), the people on the
    chosen team, the suggestions and the search. Which team is being edited is
    in none of them — it is in the pressed tab and in the name field — so
    confirm a reader who jumped straight to "People on this team" can still
    find out which team that is without leaving the section.
23. Reach the team tabs. They are toggle buttons inside a group named "Your
    teams", not a tablist: Tab moves between them and each announces its pressed
    state. Arrow keys do nothing and no tab panel should be announced. Both are
    deliberate — a tablist owes the reader arrow-key navigation and a panel per
    tab, and what is below is one editor that changes its contents.
24. Add somebody, then remove them. Each change should be announced politely,
    "Saving…" and then "Saved.", with the cursor left where it was: the reader
    is in the middle of clicking names, and ten additions must not be ten
    interruptions. Confirm the announcement arrives on the **first** change of
    the visit. The region is in the document from the start, empty, for exactly
    this — one added at the moment it has something to say has not been watched,
    and that first announcement is the one that goes missing.
25. Work both ways of adding a person. From a group: the window the suggestions
    cover is read as text, "no longer active" is part of the spoken row rather
    than a colour, and each button names the person it adds. By name: the same,
    from the search field.
26. Clear the team's name, or leave only spaces in it. That is the whole of the
    reachable error: the field carries `maxLength`, so the length half of the
    rule cannot be typed into. The error should be announced without moving
    focus, the field should read as invalid, and what was typed should still be
    there — the draft is kept whether or not the store would take it.

### Settings

27. Each weekday input should announce its own weekday and its current value.
28. Enter 30 in one. The error should be announced without moving focus, and the
    field should read as invalid.
29. Change the language. Everything should be re-announced in the new language,
    including the error still on screen.

## Colour and contrast

30. In both colour schemes, check the chart tokens against their card: the
    lightest heatmap band, the target line and the smallest bar. The contrast
    gate measures all of it against both card surfaces on every `verify`, so
    this step is looking for what a ratio cannot see: a band that
    passes its floor and still reads as the one above it, or a mark that clears
    3:1 and still disappears into the page.
31. Turn on the operating system's high-contrast or forced-colours mode. Nothing
    should become invisible; bars may lose their fill, which is why every figure
    is also written out.
32. Simulate protanopia and deuteranopia on `/insights`, `/team` and `/teams`.
    The project split should still be readable — it always is, because each row
    is labelled. On the team report, a day above the reference should still be
    distinguishable from one that met it: the bar crosses a dashed rule, which
    is a difference in shape rather than in hue. On `/teams`, the team being
    edited is a filled tab among unfilled ones; the fill is the only thing on
    that screen carrying a state, so confirm what survives the simulation is the
    weight change the pressed tab also carries.
33. Read the sign-in screen's left panel in both colour schemes. It is the one
    large branded surface in the app, and its decorative week is `aria-hidden`,
    which means axe's `color-contrast` rule skips those labels entirely. This
    step is their only automated-coverage gap: the weekday labels and the
    positioning line have to be legible on the panel, not just present.
34. Set a weekday target low enough to meet, and read the brass seal on the met
    figure. `--seal` is the one interface colour axe has never evaluated: no
    fixture day in the acceptance suite reaches its target, so the state that
    uses it never renders in a browser under test. Its ratios are held by
    `bun run a11y:contrast`; what it looks like beside the figure is not.

## What to do with a finding

Fix it and add the assertion that would have caught it. If no level could have
caught it, say so in `test-plan.md` under what no level covers.
