# Design

## 1. Why this is not the teams document again

The teams endpoint refuses a stale write and hands back what it was racing, and
the screen says "changed somewhere else". That is right for a roster: it is
edited deliberately, in one place, by somebody looking at it, and silently losing
a colleague is the worst thing that surface can do.

None of that holds here. Preferences change in the background, one field at a
time, from a form nobody is watching for a verdict. The loser of a race is a
number the reader can see and retype. A modal about it would be a dialog over
nothing.

So: **last write wins on a recorded instant**, and the instant is the mechanism
rather than a tiebreak.

## 2. Last-write-wins built _on_ the conditional write, not instead of it

The endpoint's one discipline — every write names the version it replaces, and
one that names none is refused 428 — is not weakened. There is no unconditional
mode and the store port gains nothing.

Last-write-wins is a **client policy** expressed in one bounded retry:

```
PUT with the etag we read
  409 → compare their `updatedAt` with ours
        theirs is newer or equal → adopt theirs, stop
        ours is newer           → PUT once more with their etag
                                  409 again → adopt what comes back, stop
```

It terminates in at most two writes, and the second conflict is resolved by
adopting rather than by looping — which is the same answer last-write-wins would
have given, since a third writer landing between the two is by definition later
than both.

## 3. `updatedAt` belongs to the document, not to `Preferences`

`Preferences` stays `{ dailyTarget, timeZone }`. Every screen that reads it is
reading the reader's settings, and none of them has any business with when they
were last touched.

The instant lives on the envelope both stores carry:

```ts
interface StoredPreferences {
  readonly preferences: Preferences
  /** An ISO instant, or null when this device has never recorded one. */
  readonly updatedAt: null | string
}
```

**This was an epoch date first, the way an unreadable team is, and that was
wrong.** `entities/teams/model/team.ts` dates an unreadable team to the epoch
because a team is ordered against other teams in one document, where "oldest"
is a usable answer. Here the two documents being ordered were written by
different devices, and an epoch date said "1970" about a document nobody dated —
so two devices that had both never recorded an instant agreed with each other
while holding different settings, and drifted apart in silence.

Null instead, and the rule answers by provenance rather than by an ordering that
does not exist. A device holding one does not compete: it adopts whatever the
store has, and pushes only against a store holding nothing at all. Adopting is
what stops a fresh install from pushing its defaults over settings the reader
really set on another machine; pushing against an empty store is what carries
the settings of a device that was holding them before any of this existed.

That push is **stamped** on the way out. An undated document is not storable —
nothing could order it, and the endpoint refuses one — and reaching an empty
store is the moment those settings are published, so it is the moment they are
dated. A reader can still lose a setting they can see, but only to an instant:
the other device wrote later, which is the whole rule.

## 4. The device is still the read path

`useStoredValue` reads `localStorage` synchronously on mount, exactly as today.
No screen gains a skeleton, no query is introduced, and a reader with no session
— the sign-in screen, which is below this provider — behaves as it always did.

The sync is an effect beside it. It fetches once, reconciles, and then writes
through on change, **debounced**: the weekday fields are spinbuttons and a write
per keystroke would be seven requests to set one number.

## 5. What a failure is allowed to do

Nothing, on every screen except the one that owns these settings.

A store that will not answer leaves the reader with their own device's values,
which is what they had before this change existed. Settings says so in one quiet
line, because a setting that silently stops following the reader between machines
is exactly the kind of thing that is discovered months later on the wrong number.
It is not a dialog and it does not block: the field the reader just changed took
effect locally, and that is true whatever the store said.

## 6. One handler, two documents

`handle-teams.mts` becomes `handle-document.mts`, parameterised by the suffix its
key carries, the document it parses and the size it accepts. The security
property is unchanged and is worth restating because the refactor is where it
could quietly be lost: **the suffix is a constant chosen by the function module,
never a value read from the request.** `v1/${sub}` and `v1/${sub}/preferences`
are both derived from a subject the signature established and from nothing a
caller sent, so addressing another reader's anything stays inexpressible rather
than refused.

Duplicating sixty lines of credential handling into a second module was the
alternative, and it is worse: the two copies would be the two places to fix a
rule, and the second one is the one somebody forgets.
