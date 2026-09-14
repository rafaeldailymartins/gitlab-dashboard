# Regression checklist

The manual pass before a release, in a real browser against the real GitLab. The
automated suites cover the same ground against stubs; this list exists for the
things a stub cannot be wrong about.

Work through it on the Netlify deploy preview, signed out, in a private window.

## Signing in

- [ ] `/` redirects to the sign-in screen, and there is nowhere to paste a token.
- [ ] The sign-in screen is full-bleed: no header above it, the mark and the
      positioning line on one side, one button on the other.
- [ ] Its own colour-scheme control works and the choice holds across a reload.
      This is the first screen a new reader sees, so it is where the theme is
      applied before first paint for the first time.
- [ ] "Continue with GitLab" reaches GitLab's own authorization page.
- [ ] Granting access returns to the dashboard with hours on it.
- [ ] `localStorage` holds `gitlab.refreshToken` and nothing that looks like an
      access token. Check it: `Application → Local Storage`.
- [ ] `sessionStorage` and `localStorage` hold no `gitlab.pendingAuthorization`
      once the callback has finished — it is consumed, so a replayed callback
      cannot work.
- [ ] Declining access on GitLab's page returns to a screen that says the
      sign-in did not complete and offers another attempt.

## The figures

- [ ] Today's hours match what GitLab's own time-tracking report shows for today.
- [ ] Open a day and check its issues and hours against the same day in GitLab.
- [ ] A day with time logged after 21:00 local sits on the day it was logged, not
      the next one. This is the one that silently moves hours; check it whenever
      the time zone handling has been touched.
- [ ] The month total equals the sum of the days listed for that month.
- [ ] `/insights` shows a square for every day of the month, with working days
      that hold nothing visibly distinct from days that hold time.

## Coming back

- [ ] Reload. The figures appear before the network panel shows a GraphQL
      request — and within five minutes there is no request at all.
- [ ] Throttle the network to "Slow 3G" and reload. Same: figures first.
- [ ] Leave the tab for more than five minutes, return, and the report says it is
      updating while the old figures stay on screen.

## Syncing

- [ ] The dashboard, `/insights` and a day screen each name the time the hours
      arrived, in the configured time zone.
- [ ] Log time in GitLab, press sync, and the new hours appear without a reload.
- [ ] While the request is in flight the icon turns and the text says the hours
      are being updated; the old figures stay on screen throughout.
- [ ] Turn the network off, press sync, and the failure is named beside the
      button while the last-sync time stays where it was. Turn it back on and
      press sync again: it recovers without a reload.
- [ ] With "reduce motion" on in the operating system, the icon does not turn,
      and the text alone reports the sync.
- [ ] Leave the tab overnight and return: the time reads as a date and a time,
      not as a bare clock time from yesterday.

## The session ending

- [ ] Sign out. The reader lands on the sign-in screen.
- [ ] `localStorage` no longer holds a refresh token.
- [ ] IndexedDB no longer holds `gitlab-dashboard`.
- [ ] Sign in again: the dashboard starts empty and loads, rather than showing
      the previous person's hours.
- [ ] Delete the refresh token by hand, then navigate. The app asks for a new
      sign-in instead of failing silently.

## Preferences

- [ ] Change a weekday's target. The dashboard and the week strip use it.
- [ ] Enter 30 hours. It is refused with a message, and the old value stands.
- [ ] Change the time zone to one on the other side of the date line. Days
      regroup, and the day feed's dates change accordingly.
- [ ] Switch language. Every visible string changes, including dates and
      numbers — `21 de agosto de 2026` and `6,7`, not `August 21` and `6.7`.
- [ ] Switch language while the settings form has an invalid value. The error
      message changes language and the value is still refused.
- [ ] Switch the colour scheme. Reload: the choice holds, and there is no flash
      of the wrong theme before the first paint.
- [ ] Set the scheme to "Follow my system", then change the system setting. The
      app follows without a reload.

## The team report

- [ ] Open `/team` with no group. It asks you to choose one rather than failing.
- [ ] Choose a group from the picker. The field opens a list on click, filters
      as you type, and shows the chosen group's name once the popup closes.
- [ ] Rows appear for everybody who logged something. Anybody on the membership
      who logged nothing is named in one line under the table instead, and
      anybody whose hours GitLab withheld keeps their row.
- [ ] On a group where GitLab holds hours back, the cells carry a bracketed
      `(+n)` on the days it counted them, and the row note disappears once every
      withheld entry has a day. Confirm the row total did **not** change.
- [ ] On a group where nothing is withheld, watch the network: no
      `GroupColumnProbe` request is made at all.
- [ ] While the month is still reading, no per-person figure is shown: the cells
      and the totals hold reserved space. Confirm no name is ever beside a zero
      that later changes.
- [ ] Scroll the matrix sideways. The person column and the total column stay
      put; the two header rows stay put when it scrolls down.
- [ ] Switch to Weeks and back. The address changes both times, and reloading it
      shows the same axis.
- [ ] Order by Total, twice. The ordering reverses, and the heading says which.
- [ ] Move a month back and forward. The address follows, and the figures change.
- [ ] Open `/team?group=<a group you cannot read>`. It says so, and shows no
      figures.
- [ ] Open `/team?month=1999-99`. It recovers to a real month.
- [ ] With a group where GitLab holds hours back, the status region says how many
      and the affected row says how much.
- [ ] Sign out and back in. No group figures are restored from the device before
      GitLab has answered.

## Deep links

- [ ] Open `/days/<a date with hours>` directly. It loads that day.
- [ ] Open `/days/2000-01-01`. It says nothing was logged rather than failing.
- [ ] Open `/insights` directly, signed out. Sign in, and the app lands on
      `/insights` rather than on the dashboard.
- [ ] Open `/team?group=…&month=…&by=weeks` directly. It loads that exact view.
- [ ] Hard-refresh any deep link. The Netlify SPA fallback serves it.

## The phone

- [ ] At 375 pixels, no screen scrolls sideways.
- [ ] A day row's issue title is readable — not squeezed to nothing by the
      project reference beside it.
- [ ] Signed in, the header's navigation is reachable, and its four links wrap
      rather than pushing the row sideways.
- [ ] On the team report, the matrix scrolls inside its own bounds and the page
      does not.
- [ ] Signed out, the sign-in screen stacks its two panels rather than scrolling
      sideways, and the decorative week keeps its labels legible.
