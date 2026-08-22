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

1. Load the dashboard and press Tab from the top. The order should be: skip
   nothing, header, navigation, colour scheme, sign out, week strip left to
   right, then the feed newest first.
2. On a day row, press Enter. It expands. Press Enter again: it collapses.
3. Tab into an expanded day. The issue links come next, in the order shown.
4. On `/insights`, Tab to a table header and press Enter. The sort changes, and
   focus stays on the header rather than jumping to the top of the table.
5. Nowhere should Tab reach something invisible, and nowhere should it skip
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

### Settings

10. Each weekday input should announce its own weekday and its current value.
11. Enter 30 in one. The error should be announced without moving focus, and the
    field should read as invalid.
12. Change the language. Everything should be re-announced in the new language,
    including the error still on screen.

## Colour and contrast

13. In both colour schemes, check the chart tokens against their card: the
    lightest heatmap band, the target line and the smallest bar. The palette in
    `src/app/charts.css` was validated against these surfaces, so a failure here
    means a token was edited without re-validating.
14. Turn on the operating system's high-contrast or forced-colours mode. Nothing
    should become invisible; bars may lose their fill, which is why every figure
    is also written out.
15. Simulate protanopia and deuteranopia on `/insights`. The project split should
    still be readable — it always is, because each row is labelled.

## What to do with a finding

Fix it and add the assertion that would have caught it. If no level could have
caught it, say so in `test-plan.md` under what no level covers.
