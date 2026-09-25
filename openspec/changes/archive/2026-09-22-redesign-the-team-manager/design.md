# Design

## 1. A dialog, and what that costs

The shipped surface is a screen because of an argument that was sound and turned
out to be about the wrong thing: the accessibility and 375 px sweeps address
every screen by URL, there was no dialog primitive in `shared/ui`, and
`/settings` was the precedent for "a place where the app's own state is edited".

Every clause of that is still true. None of it is a reason to make the reader
leave the report. The sweeps address a _screen_; a dialog is reached by opening
the screen it sits over and clicking one control, which the step does in two
lines instead of one. The missing primitive is a missing primitive — it is added
here, from the same registry every other component comes from. And `/settings` is
the wrong precedent: settings are edited once and rarely, from anywhere, with
nothing on screen depending on them. A team is edited _because of what the report
in front of you shows_, and the report is the thing you go back to.

So `/teams` is removed rather than kept alongside. Two ways to the same list is
two states to keep agreeing, and the address was never worth sending anybody: the
route carried no search parameters precisely because there is nothing in it but
this reader's own private list.

`shared/ui/dialog.tsx` comes from `shadcn add dialog` (Base UI, `base-nova`),
with four deviations recorded in the file:

- `cn` is imported from `@/shared/lib/utils`. The generator wrote `from "cn"` and
  installed an unrelated package of that name — the alias in `components.json`
  did not resolve. Left alone it would have added a dependency this app does not
  use to the audit surface.
- The backdrop is `bg-black/60`, not `bg-black/10`. A tenth of an alpha over this
  app's own dark surfaces is not a dimming, and the dialog it is meant to lift
  reads as a panel that happens to be in front.
- The close button's label is a message rather than the literal `Close`. No
  user-facing string in this repository is a literal.
- `sm:max-w-sm` is not carried as a default. This dialog is two panes wide; a
  default the one caller always overrides is a default that misleads the next
  one.

**`shadcn add` also overwrote `button.tsx`.** That file carries four measured
contrast fixes, three of which `bun run a11y:contrast` holds — so the regression
would have failed `verify` rather than shipped. It was restored from git. The
note in `AGENTS.md` saying regeneration means re-applying them is now a note that
has been needed.

## 2. Creating a team is one action

The editor's group combobox is deleted. In its place:

```
New team
├── From a GitLab group          (the reader's groups, searchable)
│     SQUAD Fiscal    invent/squads/fiscal
│     SQUAD TaxPlus   invent/squads/taxplus
└── Start blank
```

Choosing a group reads who logged time in it, then mints the team **already
full** — one `apply`, one conditional write, one version. The alternative shape,
creating the team first and adding people as they arrive, was rejected: it is two
writes where the second can be refused on its own, leaving a team on the reader's
list carrying the group's name and none of its people, which is worse than a
spinner.

So the wait is real and it is stated: the button that started it shows the group
being read. That is what makes §4's bounds load-bearing rather than tidy.

The same list is reachable from the editor as **Add from a group**, which merges:
everyone read who is not already on the team joins, and nobody is taken off. That
is the half of "a suggestion is not a subscription" the merge could have broken —
a refresh that reconciled both ways would drop the colleague the reader added by
hand, which is exactly the rule GROUP-15 exists to state.

## 3. The name is the group's, and nothing else is

The team is named after the group and carries no reference to it. Storing the
path would create a second thing that can be stale — a team pointing at a group
somebody renamed, moved, or revoked the reader's access to — and would invite the
"refresh from group" that GROUP-15 forbids. The name is a string the reader may
edit the second after it is minted, which is what it should be.

## 4. Thirty days, four pages

`WINDOW_DAYS` 90 → 30 and `MAX_PAGES` 10 → 4.

The read is strictly sequential — each page needs the previous page's cursor —
so the worst case was ten round trips before anything appeared, over a window
three times wider than needed. Both numbers are cut where they multiply: a
thirtieth of a year rather than a quarter, and four hundred entries rather than a
thousand.

What that costs is stated rather than hidden. A group busy enough to exceed four
pages in thirty days reports its people as possibly incomplete, and the search by
name — which reaches anybody, logged or not — is the escape hatch it always was.
What it buys is that the common case is _one_ request: a squad of ten logging two
entries a day fills about four hundred entries a month, and the newest hundred of
them already name everybody.

Ninety days was chosen to catch somebody who was away for a sprint. Thirty does
not, and that is the trade the reader asked for, knowing it: the person it misses
is one search away, and the alternative was every reader paying for the rare one
on every seed.

## 5. The toolbar

Four controls sat in one row at three different heights, two of them under
stacked labels, the fourth an underlined text link. The labels were the worst of
it: they made two controls two lines tall and the others one, so `items-end`
aligned things that were never the same shape.

They are now one strip of `h-9` controls sharing `rounded-lg border-input`, named
by `aria-label` rather than by a label above them. The name is not lost — a
`select` and a `combobox` both take an accessible name from `aria-label`, which
is what the assistive tree reads and what `getByLabel` finds — and the visible
label was restating what the control's own value already says.

The way into the teams dialog is an icon button **inside the team control's
strip**, sharing its border. A control that acts on the thing beside it should be
attached to it; at the end of a row of unrelated controls it read as a fifth
filter.
