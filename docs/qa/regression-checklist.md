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
- [ ] The scopes on that page include the OpenID one as well as `read_api`. An
      application without `openid` ticked refuses every sign-in outright with
      `invalid_scope`, so this fails here rather than on the teams dialog.
- [ ] Granting access returns to the dashboard with hours on it.
- [ ] `localStorage` holds `gitlab.refreshToken` and nothing else that looks like
      a credential: neither the access token nor the `id_token` the teams
      endpoint takes reaches storage — both are closure variables that die with
      the tab. Check it: `Application → Local Storage`.
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

## Teams

- [ ] The teams surface is not in the navigation and should not be: the header
      still carries four links. It opens as a dialog from the teams button in the
      report's toolbar and from the teams card on `/settings`, and both open the
      same one. There is no `/teams` address any more; typing one 404s, which is
      the honest answer.
- [ ] Open it from the report, change the team, close it. You are on the same
      report, on the same month, with the change in it — no navigation, no
      reload, no lost place.
- [ ] Press "New team", then a group. The team is made in one action, named after
      the group and carrying everyone who logged time in it over the stated
      window. Watch the network panel: at most four `GroupSuggestions` requests,
      and one write.
- [ ] Press "New team". A team appears already chosen, and the notice under the
      heading reads "Saved." before you have typed anything: every edit here is a
      save, and there is no draft to lose.
- [ ] Rename it. The save happens when the field is left or Enter is pressed —
      watch the network: one `PUT` for the rename, not one per letter.
- [ ] Empty the name. The field says a name is needed, nothing is sent, and what
      you typed stays in the field.
- [ ] Choose a group under "Group to suggest from". The names offered are whoever
      logged time there since the date the list states — ninety days back — and
      not the group's membership: somebody with access who logged nothing in that
      window is absent, and somebody who logged without being a member is there.
- [ ] Somebody who has since left is still offered, marked "no longer active".
      They logged the time, so a month that holds it is about them.
- [ ] On a group with more entries than one read covers, the list says so rather
      than presenting itself as the whole answer.
- [ ] Add two or three of them. Each add saves on its own, and whoever is added
      stops being offered.
- [ ] Add somebody who has logged nothing anywhere — a new joiner — through "Add
      anybody by name". The suggestions cannot reach them and the search can.
- [ ] Watch one of those saves in the network panel: a `PUT` to
      `/.netlify/functions/teams` carrying an `Authorization: Bearer` header, no
      cookie, and no identifier anywhere in the address. The answer says
      `cache-control: no-store`.
- [ ] Turn the network off and remove somebody. The notice says the change could
      not be saved and the person is **still on the list**: the screen shows what
      the store holds, never what you typed. Turn it back on, remove them again,
      reload — that one stuck.
- [ ] Open your teams on a second device, signed in as the same reader. The same
      teams are there. Add somebody there; then, without reloading the first
      device, remove somebody on it. The first says the teams were changed
      somewhere else, the list in front of you becomes the second device's
      version, and your change was not saved. Make it again and it lands.
- [ ] Delete a team. It goes, the editor falls back to whatever is left rather
      than to an empty form, and a reload confirms it.
- [ ] Sign in as a different GitLab account in another private window. It has its
      own teams and never yours: the storage key is derived from the identity
      GitLab signed, not from anything the request carried.
- [ ] A session granted before this release carries no identity, and renewing
      carries the old scopes forward, so this one is done on the production URL:
      sign in there before promoting, and do not sign out afterwards. `/team`
      says, in place of the report, that permission to identify you is missing
      and that signing in again grants it; the teams dialog says the same above an empty
      list. The dashboard, `/insights` and a day screen are untouched, and
      nothing has signed you out. Sign in again: both screens work.

## The team report

- [ ] Open `/team` in a fresh tab with nothing after it. It opens on the team you
      looked at last and the address gains `team=`; the filter is empty, and the
      line under the heading says the figures cover every hour GitLab will show
      you for these people, wherever they logged it.
- [ ] Switch team in the picker — a plain select, not a search field. The figures
      change, the address follows, and a reload keeps that team.
- [ ] Rows are the team, exactly. Count them against the members list on
      the teams dialog: everybody you put on it has a row, including somebody who logged
      nothing, and no line under the table names anybody.
- [ ] Watch the first round in the network panel: one `TeamHoursPage` request
      carries the whole team, however many people are on it. Somebody whose month
      does not fit one page is continued by `TeamHoursFollowing`.
- [ ] While a large month is still reading, rows that have been read show their
      figures while the rest still pulse — each person is read to their own
      frontier. The row totals, the column totals and the corner stay reserved
      until everybody has been read.
- [ ] With no filter, hours logged outside any group you share are in the
      figures: pick somebody who logs time in a personal project and check their
      row against GitLab's own report for that person.
- [ ] Read an empty working day with a screen reader, or in the accessibility
      inspector. Unnarrowed it says no hours were logged anywhere; with a group
      in the filter it says no hours in that group, and never more than that.
- [ ] Narrow to a group. The line under the heading and the table's caption both
      name it, the address gains `group=<path>`, and the figures shrink to that
      group and its subgroups.
- [ ] With a group chosen, compare the request payloads: `TeamHoursPage`,
      `TeamHoursFollowing` and `TeamColumnProbe` all carry the same group. An
      instrument measuring a wider set than the figures makes every shortfall on
      the screen nonsense, and both numbers look reasonable while it does.
- [ ] Open `/team` bare again. The team is remembered; the filter is not, and the
      scope line is back to covering everywhere.
- [ ] Open `/team?group=<a group you cannot open>`. The figures are there,
      unnarrowed, and a line above the table says the narrowing was dropped. The
      filter still shows the path your link asked for rather than resetting
      itself.
- [ ] On a team some of whose hours GitLab holds back from you, a row's total
      carries "+n h hidden" once the month has been read. Wait for the placement:
      the cells for the days the provider counted them grow to include them, the
      note goes when nothing is left over, and the row, the column and the corner
      still add up.
- [ ] Somebody the provider counted hours for and showed none of keeps their row,
      with "Hours you cannot read" under their name.
- [ ] On a team where nothing is withheld, no `TeamColumnProbe` request is made
      at all. Where more than six rows are short, no more than six are made: the
      rest keep the note, and their cells stay at what arrived.
- [ ] Scroll the matrix sideways: the person column and the total column stay
      put. Scroll it down: the two header rows and the totals row stay put.
- [ ] Switch to Weeks and back. The address changes both times, and reloading it
      shows the same axis.
- [ ] Order by Total, twice. The ordering reverses, and the heading says which.
- [ ] Move a month back and forward. The address follows, and the figures change.
- [ ] Change the time zone in `/settings` and come back. A teammate's entry
      logged late in the evening sits in the day it was logged in the new zone,
      and every total still equals the cells it is over.
- [ ] Open `/team?month=1999-99`. It recovers to a real month. Open
      `/team?team=<an identifier you do not have>`: it says that team is not one
      of yours rather than quietly showing your first one.
- [ ] Make a team with nobody on it and open the report on it. It says so, and
      asks GitLab nothing — no `TeamHoursPage` request is made.
- [ ] The key lists only the marks the table uses, plus the reference bar, which
      says the bars are measured against 8 h a day.
- [ ] Of all of that, the device keeps one thing: `localStorage` holds
      `team-report-team`, an opaque identifier this app minted, and no name, no
      colleague and no figure. IndexedDB holds no team and no roster.
- [ ] Sign out and back in. No roster and no figure is painted from the device
      before the teams store and GitLab have answered.

## Deep links

- [ ] Open `/days/<a date with hours>` directly. It loads that day.
- [ ] Open `/days/2000-01-01`. It says nothing was logged rather than failing.
- [ ] Open `/insights` directly, signed out. Sign in, and the app lands on
      `/insights` rather than on the dashboard.
- [ ] Open `/team?team=…&month=…&by=weeks` directly. It loads that exact view,
      whichever team you looked at last.
- [ ] Add `&group=…` to the same address. It loads narrowed; drop the parameter
      again and the same month loads unnarrowed.
- [ ] Open the teams dialog from anywhere. Nothing you do in it puts anything in
      the address, and closing it leaves the address exactly as it was: these are
      your own teams, and there is nothing to send anybody.
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
