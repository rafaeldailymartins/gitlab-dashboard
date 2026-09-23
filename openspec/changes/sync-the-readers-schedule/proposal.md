# The schedule and the time zone follow the reader

## Why

Two of this app's four settings are facts about the **person**: how many hours a
full day is on each weekday, and the time zone that decides which calendar day an
entry lands on. Two are facts about the **device**: the colour scheme and the
language.

All four are on the device, and the two that are not about it drift. Set a six
hour Monday on the laptop and the phone still measures against eight.

That used to be a mild annoyance about the reader's own dashboard. It stopped
being mild when the team table started measuring its bars against the daily
target rather than a fixed eight-by-five: **the same month now draws different
bars and tints different columns on two machines belonging to one person.** A
report whose shape depends on which laptop is open is a report nobody can quote.

## What changes

- `dailyTarget` and `timeZone` are kept in the reader's own store, beside their
  teams, under a key derived the same way from the same verified subject.
- The device stays the read path. Nothing waits on the network to paint: the
  local values are read synchronously as they are today, and the store
  reconciles afterwards.
- Reconciliation is **last write wins on a recorded instant**, not the teams
  document's refusal-and-notice. A preference is not a roster: the loser of a
  race is one setting, the writes happen in the background, and a dialog about a
  colour of a number nobody chose deliberately is worse than the drift.
- The colour scheme and the language stay on the device and are not synced. The
  theme is read by an inline script **before the first paint** precisely so the
  wrong colour never flashes; putting it behind a request would reintroduce what
  that script exists to prevent.

## Impact

- Specs: `user-preferences` gains PREF-7.
- Code: `netlify/lib/handle-teams.mts` becomes a document handler two functions
  share; `netlify/functions/preferences.mts` is new; `entities/preferences`
  gains ports, an HTTP gateway and a reconciliation rule; `PreferencesProvider`
  gains an optional gateway.
- No change to what any screen paints before the store answers.
