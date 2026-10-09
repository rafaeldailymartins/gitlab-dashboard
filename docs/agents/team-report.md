# Team report: decisions that will look wrong until you know why

Moved out of `AGENTS.md` so that they load where they apply: a `CLAUDE.md` in
`src/pages/team-hours/`, `src/entities/team-timelogs/`, `src/entities/teams/`
and `src/widgets/team-manager/` imports this file. The rule they were written
under still holds: each was tried the obvious way first and changed on
evidence, and reverting one without reading the reason will reintroduce a bug
that is already fixed. Three that govern `shared/` code — the dropdown panel,
the search debounce and the day-span bisection — stay in `AGENTS.md`.

- **The team report asks for a period; the personal one still does not.** They
  read the provider differently on purpose. `startDate`/`endDate` are truncated
  to UTC calendar days — that is `TimelogResolver#parse_datetime_args` calling
  `beginning_of_day` — but `startTime`/`endTime`, when both are given, are passed
  to the query untouched. So a bounded month is askable. It is still asked one
  whole UTC day wider at each end and cut locally by `entriesWithin`: rounding
  can only move a start earlier and an end later, so the answer stays a superset
  of the reader's month under every reading of the range, and the same cached
  answer stays right if the reader changes time zone. One day of slack is always
  enough, because no IANA offset exceeds fourteen hours. Never send `startTime`
  with `endDate` — `validate_args!` permits that pair and it silently truncates
  one end only. The connection this hangs from moved from a group to each
  person; `model/window.ts` did not change with it, because the widening is
  about how the provider reads a range and not about whose hours are inside it.
- **A team figure is checked against GitLab's own count, not against nothing.**
  `TimelogConnection.count` and `totalSpentTime` are computed in SQL over the
  whole unpaginated relation, _before_ `remove_unauthorized` deletes the entries
  the reader may not read from the node array — silently, with no null and no
  error. The difference between the two is the only instrument that can see that
  removal at all, and a `User`-parented connection makes it per person, which is
  what lets a row say it is short rather than the footer say the team is. The
  difference is reported **signed**: a withheld correction makes the figures too
  high, and clamping at zero would turn that into "nothing is missing".
  `username:` is gone from both documents: the connection under `users(ids:)` is
  already one person's, which also removes the one place a period aggregate and
  a column aggregate could have disagreed about who they were about.
  This paragraph used to end by ruling the widening out, and it was wrong. The
  argument was that `count` on a user-parented connection is computed before
  redaction and would publish the volume of work in namespaces the reader cannot
  open (gitlab-org/gitlab#425747), so widening the scope would cost the screen
  its instrument and leave every total collected rather than checked. It is the
  other way round: the figure that survives redaction is the only thing a total
  can be checked against, and on this screen it is deliberately also the answer —
  a reader who chose these people asked how many hours they logged, and an hour
  they cannot itemise is still an hour they are owed a number for. The
  instrument did not survive the widening by luck; it is what the widening runs
  on. It also got stronger in the move: the group shape asked the aggregates in
  a second document (`GroupMonthProbe`), so the count and the nodes it judged
  were read at two instants, while `TEAM_HOURS_PAGE` asks both on the same field
  of the same request, where the aggregate and the nodes are one relation under
  one range and cannot disagree at all.
- **The group filter goes through all three documents and both query keys, or
  through none of them.** `TEAM_HOURS_PAGE`, `teamHoursFollowing` and
  `teamColumnProbe` each take `$group: GroupID`, and in `queries.ts`
  `teamHoursQuery` keys on the month, `groupId` and the roster, and
  `teamColumnsQuery` on the person, `groupId` and the spans. Leaving it out of one of them is
  the worst bug this screen can have, because nothing on it would look wrong: an
  instrument measuring a wider set than the figures reports hours withheld that
  were merely filtered out, an instrument measuring a narrower set reports none
  when some are, and both numbers are plausible. Leaving it out of a key is the
  same failure through the cache — the reader narrows the scope and is shown the
  previous answer. There is no partial state to get right here; there is one
  argument threaded to the end or nothing.
- **One request carries the whole team, aggregates included.** GraphQL
  complexity counts fields in the document, not rows in the answer, so
  `users(ids:)` with one `timelogs` field under it costs the same whatever the
  roster's length: measured, 26 points of the 250-point budget for one person
  and 29 for sixteen. The group shape needed `1 + ceil(E/100) + ceil(P/32) + <=6`
  requests and was dominated by a serial page walk that every row waited on.
  Two things follow. `users.pageInfo.hasNextPage` is read only to refuse — the
  page size is the batch's own length, so a true there means the provider capped
  the team, and a report that quietly omitted a colleague is worse than one that
  fails. And continuing is a separate document: a node's cursor cannot travel
  back through `users(...)`, because each connection under a node has its own
  cursor space and the parent field has no argument reaching into it. That one
  is bounded by complexity rather than by taste — one alias scores 17, sixteen
  score 227, twenty-four score 339 and are refused — so the batch is sixteen.
  Seventeen fits at 241 and leaves nine points, which is not enough to absorb a
  field somebody adds later.
- **The grid is handed the whole window and cuts the month itself.** It needs two
  answers out of one set of entries, and they are not over the same span. The
  cells and every total on screen are the reader's month. The per-person
  shortfall is not: it is measured against what the provider declared,
  and the provider declared over the window it was asked about, which is the month
  widened by a day at each end. Cutting before the grid — which is what it used to
  do — compared a declaration over the window against hours drawn for the month,
  and so reported every hour logged on a padding day as an hour withheld from the
  reader. A person who logged eight hours on 31 August had "+8 h hidden" against
  their September row. It is exact this way round because a connection's
  aggregate and its nodes are the same relation under the same range: whatever the
  provider took the range to mean, the two agree, so their difference is the
  removal and nothing else.
- **There is no `user`-recovery document, and there should not be.** The obvious
  mirror of `MY_TIMELOGS_WITHOUT_PROJECT` is unreachable: `TimelogType#user`
  resolves through a batch loader whose default is the Ghost user, and
  `read_user` is enabled for any authenticated caller, so a node nulled by an
  unresolvable `user` cannot happen. An earlier draft carried one, along with a
  permanent `person: null` branch through the whole model that no real answer
  could produce.
- **A cell past the read frontier is `pending`, and that beats `logged`.** Pages
  arrive oldest first, so until a day has been read past, more entries may still
  land in it. Showing what has arrived so far would put a figure that is about
  to change next to somebody's name, and "logged nothing" beside a real
  colleague is the worst thing this screen could say.
  The frontier is **per person**, not per report: each row is its own
  connection, so a month that fitted one round is final while somebody else is
  still being read, and `frontierOf` in `model/report.ts` is computed from that
  person's own newest entry. The row's total follows the same read: `GridRow.settled`
  is that person's connection having no cursor left, never the frontier reaching
  the month's end — a padding-day entry does that one round early. It waited on
  the whole team for a while after the cells stopped doing so, and a finished
  colleague's total sat as a pulsing bar beside cells that already showed it.
  `TeamReport.complete` is the only thing that waits on everybody, because it is
  the figure about the whole team — the footer — and what the six-row placement
  cap is chosen over.
  The frontier is the day _before_ the newest entry read, since the next round
  can still carry more of that same day.
- **Bars on the team screen measure against the reader's own working schedule,
  and the legend says so.** The `dailyTarget` from Settings, per weekday, passed
  by `useTeamReport` as the grid's `reference`. This reverses a constant — eight
  hours Monday to Friday — chosen so the screen would not assert a part-time
  teammate's every day as short on the strength of the reader's contract. The
  argument assumed the reader's target describes the reader alone; the person
  who opens this screen leads the team on it, and their schedule is the only
  statement anywhere in the app of what a full day is where they work. The
  constant replaced it with a schedule nobody chose, and a lead with a six-hour
  Friday read every Friday as short one screen away from where they had said
  otherwise. What survived is the honesty half: the reference is stated. The
  legend names no number of hours, since a per-weekday schedule has none; it
  says each bar is measured against the day's target. The reference is applied after
  the entries are read and is in no query key, so editing it redraws the month
  and refetches nothing. `REFERENCE_SCHEDULE` is now `EIGHT_BY_FIVE` in
  `tests/support/`, the schedule the rules are exercised against. Over the
  reference is drawn as the bar crossing a dashed rule rather than changing
  colour: `charts.css` records that brass against brick collapses under deutan,
  which is exactly the pair a colour-coded version would have used.
- **Every person on the team keeps a row, including one who logged nothing.**
  This is the reverse of what the group report did, and the reason reversed with
  it. There, the rows came from a roster union — group membership plus whoever
  logged — so a row with thirty-one dashes was usually somebody the provider
  had put in the answer and the reader had never asked about, and dropping it
  cost a reader scanning across nothing they wanted. Here the reader typed the
  roster. An empty row is not clutter that arrived with the answer, it is the
  answer: they picked that person, and "nothing this month" is a fact about
  somebody they are watching, which is the whole reason they added them. Dropping
  it would also make the team and the table disagree about who is on it — the one
  thing a reader can check this screen against without leaving it. `teamGrid`
  maps `request.members` straight to rows and drops nobody; there is no union
  left to compute, because the provider is asked about these people and no
  others.
- **A team is built from whoever logged time in a group, not from its
  membership, and building it is one action.** Membership is an access-control
  list, and it answers a different question. Measured on one real squad: it
  offered seventeen names, eleven of which had no hours at all, while eight
  people had logged in the window and two of those were not members. So the
  people come from a trailing **30 days** of timelogs, read to a cap of **four
  pages**. Neither number is said on screen and both are in the code: a group is
  a _template_, so what the starter promises is that the reader can change who is
  on the team, not how far back the provider was read. That sentence was the
  difference between "nobody logged here" and "nobody logged here lately" while
  the reader picked names out of a list; there is no list — one click later they
  are looking at the team. The notice that said a busy group may have been read
  short went with it, for the same reversal: a census that might be short is a
  serious claim about a list that _is_ the answer and a mild one about a starting
  point being edited in front of you. What covers both bounds now is the search,
  which reaches anybody the provider knows, logged or not, and sits under the
  team rather than behind a control. `SuggestionAnswer.partial` is still computed
  and still tested at the cap — the fact stops at `useGroupSeeding`, which is the
  cheapest way to be able to say it again.
  Those two numbers were ninety days and ten pages, and both were cut for the
  same reason: the read is strictly sequential — each page needs the last page's
  cursor — so the window and the cap multiply directly into how long somebody
  waits looking at nothing, to learn a dozen names out of a thousand entries.
  What thirty days loses is somebody away for the whole month, and they are one
  search away by name.
  Naming the group **is** making the team: it is minted already full, in one
  edit to the draft, and Save writes it in one conditional write. It used to be a combobox in the editor followed by a plus
  beside each person, which asked the reader to re-answer, one name at a time and
  one write at a time, the question they had already answered by naming the
  squad. The same list is reachable afterwards as "add from a group", which
  merges and never removes — a refresh that reconciled both ways would take off
  the colleague the reader added by hand. The team keeps the group's **name** and
  no reference to it, because a stored path is a second thing that can go stale
  and an invitation to exactly the resubscription GROUP-15 forbids.
  Candidates are deduplicated by the provider's identifier, never by username,
  for the reason a roster is stored that way: a username is released on a rename
  and the same person under two of them would be added twice. Bots are dropped
  — nobody manages a bot's timesheet. Accounts that are no longer active are
  **kept**, which looks like the same clutter and is its opposite: somebody who
  logged time in the window did the work and has since been blocked or left, and
  their hours are still in the month the reader is reading. Nothing renders that
  flag any more — there is no list of candidates to mark — and `SuggestedMember`
  carries it all the same, because it is what makes "an inactive account is not
  dropped" a claim a test can fail on rather than a rule that holds until
  somebody writes the filter.
- **The teams dialog is saved on purpose, and the report follows what was
  saved.** `lib/use-team-draft.ts` collects every edit and writes once; the
  footer offers Save and Cancel, and dismissing with anything unsaved asks
  first. This reverses `use-team-edits.ts`'s own argument — that clicks
  collected into a draft are clicks lost to a closed tab, and that "unsaved" is
  an awkward thing to explain on a surface whose whole job is a list — and that
  argument is still true. What outweighed it is that save-on-edit made every
  click final: removing a colleague had no way back but finding them again by
  name.
  It also removed a defect that was nothing to do with taste. `apply` built each
  write from the list as it was last read and closed over the etag read with it,
  with no mutation scope, so two quick edits were both built on the list before
  either. Measured against a store that holds writes open: two removals from a
  team of three sent `etags = ["1","1"]` and `sizes = [2,2]` — the second
  reverting the first, and against the real endpoint refused 409 with the notice
  blaming the reader's own two clicks on somebody else. One write from one
  snapshot cannot do that.
  **A refusal is two different things and they owe the reader opposite answers.** A
  store that could not be reached changed nothing, so the edits stay on screen
  to try again. A conflict did change something — the list moved underneath —
  and TEAM-5 is that the reader sees whose it is now, so that is the one refusal
  allowed to take the edits away.
  The draft is state and nothing else. Not the query cache, which the report
  behind reads — a draft there would repaint the month under the reader and make
  Cancel a problem of putting it back. And not the device: TEAM-2 forbids a
  roster reaching storage, and the acceptance suite reads `localStorage`,
  `sessionStorage` and every IndexedDB store by content looking for exactly that.
  Two things had to change with it. The name field committed on blur and on
  Enter, so a Save while it held text dropped the rename silently; every letter
  goes into the draft now, and it follows the team during render so discarding
  puts the name back. And a group read is up to four sequential pages that
  resolve into whatever is being edited — it carries an era token now, so a read
  the reader discarded while it was in the air is dropped rather than rebuilding
  the draft they threw away.
  **Saving and cancelling both close; only a dismissal asks.** Each of the two
  buttons says what to do about the edits and there is nothing left to do here
  afterwards, so keeping the surface open would be asking the reader to dismiss
  it twice. Cancel is never disabled, because it is the way out as much as it is
  the way to undo. A dismissal — Escape, the backdrop, the close control — says
  only that the reader wants out and not what should become of what they typed,
  so that is the one path that asks. A refused save does not close: there is
  something left to read and something left to do.
  One consequence, and it was followed through: **there is no "Saved." any
  more.** The surface it lived on is gone by the time it would have said so, so
  the closing is the confirmation. It survived one commit as a state a browser
  could not reach, which is a branch every reader of `SaveState` has to rule out
  for themselves — the arm, the string in both catalogues and the acceptance step
  that read it are all deleted. What `SaveNotice` says now is only what the
  reader is still there to hear: that a save is in flight, that it was refused,
  or that somebody else wrote first.
  The question about closing is an inline bar under the footer, not a nested
  dialog: a focus trap inside a focus trap is what the keyboard sweep would find.
  It is not a live region either — `SaveNotice` is this surface's only one, and
  the acceptance suite reads it with an unscoped status locator that resolves to
  a single element only because the dialog hides the report's own.
- **The report's address follows the save, and there were two ways it went
  blank.** `pages/team-hours/lib/address-after-save.ts`. The picker's trigger drew
  with no text at all whenever the address named a team the reader did not have:
  `chosenTeam` answers `unknown`, `teamOf` gives null, and the select is handed
  a value matching no item. Two ways in, and only one is what it looks like. A
  remembered identifier that names nothing — `rememberTeam` is called from one
  place, inside a navigation, so deleting a team never forgot it and the next
  visit was redirected into a dead address; **GROUP-20 already forbade this** and
  nothing implemented it, which `arch:trace` never noticed because it matches
  requirement ids and GROUP-20 is cited by two other scenarios. And deleting the
  addressed team inside the visit, which touches nothing remembered at all.
  The first is repaired on arrival, not at the save: a team deleted from
  Settings or another device is a save this screen never sees. The route hands
  the page the remembered identifier — only it can tell an address completed
  from memory from one somebody sent — and `lib/forget-remembered.ts` moves off
  it, in place, once the list has answered without holding it.
  Neither is fixed by falling back to the first team, which GROUP-14 forbids: an
  address naming a team that was never yours has to say so. The save is the
  event instead — it is the only moment the list is known to have changed and to
  have been accepted — and the team it moves to is read from the **written
  document**, never from what the dialog minted. `withTeam` returns the list
  unchanged at `MAX_TEAMS` and on a duplicate id while the write still succeeds
  and the dialog still closes, so a minted identifier would name a team nothing
  created.
- **The teams a reader keeps are edited in a dialog over the report, and `/teams`
  is gone.** This reverses the decision the surface shipped with, and that
  decision was sound about the wrong thing: the accessibility and 375 px sweeps
  do address screens by URL, there was no dialog primitive in `shared/ui`, and
  `/settings` is a real precedent for a place the app's own state is edited.
  Every clause of that is still true and none of it is a reason to take the
  reader off the figures. Settings are edited once, from anywhere, with nothing
  on screen depending on them; a team is edited _because of what the report in
  front of you shows_, and the report is where you were going back to. The
  surface never had an address worth sending anybody — it is one reader's private
  list, which is why the route carried no search parameters — so the navigation
  bought the interruption and nothing else. The sweeps did not lose it: `SCREENS`
  in `tests/e2e/steps/keyboard.ts` reaches "teams" by the report's address plus
  one click, which is where a focus trap and a 375 px overflow actually live.
- **The report's controls are one row of `h-9` strips, named by `aria-label`.**
  Four controls sat at three different heights, two of them under stacked labels
  and the fourth an underlined text link, so `items-end` was aligning things that
  were never the same shape. The visible labels were the worst of it and they
  were also redundant: a `select` and a `combobox` both take an accessible name
  from `aria-label` — which is what the assistive tree reads and what
  `getByLabel` finds — while the label above restated what the control's own
  value already says. The way into the teams dialog is a labelled button
  pushed to the far end of the row: the controls on the left narrow or move what
  the table shows, this one changes what a team _is_, and beside a filter it
  read as a fifth one. `report-toolbar.tsx` argues that case itself.
- **The teams dialog's chunk is fetched before it is clicked.** Code-splitting it
  was right and it made the first open a network request the reader was waiting
  through: measured on the built bundle served locally, 525 ms and two requests,
  and 2.5 seconds on a machine six times slower, with an 850 ms task parsing it.
  So the button starts the import on `pointerenter` and on `focus`, and the
  report screen starts it again from `requestIdleCallback` — which is skipped
  where there is none rather than replaced by a timer that would race the
  month's own requests. Warm, the same open waits on no request.
  What is left is the page behind it being laid out again: 248 ms at six times
  slower over the month's table against 112 ms over `/settings`, which is the
  scroll lock changing the document's width and a month-wide fixed table with
  sticky cells re-measuring inside it. That is the dialog's price for locking the
  page, and it is paid once per open rather than per frame.
- **A column nothing is expected of is drawn from the reference, not from the cell's
  kind, and it is named like every other column.** "Nothing expected" means the
  reader's working schedule is zero for that weekday — not that it is a Saturday
  or a Sunday: a Saturday with hours in Settings is a working column, and a
  Wednesday without is tinted. A cell is only `non-working` once its column
  has been read and nobody logged in it, so such a column still loading — or one
  later this month — would lose its tint and its narrow width, and the table
  would change shape as the pages landed. The column is drawn from the
  reference itself — `referenceHours === 0` for the header, the footer and the
  width, and `share`, which is null exactly then, for the body cells. The
  widths live in a `<colgroup>`: a fixed table takes its widths from the first
  row, and the first row here is the week bands, whose cells span several columns
  and say nothing about any one of them.
  Those columns used to carry the date alone, on the argument that one nobody is
  expected to log in is half as wide as the others and has no room for the
  weekday's abbreviation — and that the tint said which day it was anyway. The
  second half was false: the tint says _a_ day expects nothing, never which one,
  so a reader counting across a month had two columns in every seven to work out.
  The width was this table's own choice, so the width moved rather than the
  label: `w-11` against `w-12`, still narrow enough that a month reads as five
  weeks rather than as thirty-one stripes.
  The tint runs through the footer too. It did not, and the stripe stopped one
  row short of the bottom — along the row a reader's eye actually travels, which
  is the one place the break showed. It can be both tinted and `sticky` because
  `--chart-empty` is opaque; an alpha would have the rows scrolling underneath it
  show through.
- **The chosen team is remembered; the group filter deliberately is not.**
  `lib/remembered.ts` keeps the team's identifier — never a name, never a
  colleague, never a figure, all of which `persist: false` forbids — so a return
  visit does not begin by picking your own team out of a list. An opaque
  identifier this app minted names nobody. A team has no safe default, so
  remembering it saves a choice the reader has to make anyway.
  The filter is the opposite case, and that is why it is treated the opposite
  way. Its default is the widest and most honest state — every hour GitLab will
  show this reader for those people — and remembering a narrowing would make
  every later visit show less than the scope sentence prepares the reader for,
  silently, in the one direction that understates a colleague's month.
  An address that names a team is never overridden, because a link somebody sent
  outranks this reader's habit; one that names none is completed by
  **redirecting** rather than by filling the screen in behind it, so what you are
  looking at stays what you can send somebody else.
  (Two group pickers on one screen was built and reverted once — a wider group to
  read and a narrower one to draw — and that reversal is the argument _for_ the
  pair that shipped, not against it. Those two asked overlapping questions in the
  same vocabulary, and each one's right value depended on the other's, so neither
  had a default. These two do not overlap: one names **people**, the other names
  **how much of their work counts**, and exactly one of them has a correct
  default — "all of it", which the screen says out loud. That is the property the
  reverted pair lacked.)
- **The filter travels in the address as a path, and a group the reader cannot
  open drops the narrowing rather than the report.** A path because an address is
  meant to be read and sent, and `full/path/to/group` says what it means where
  `gid://gitlab/Group/1234` does not; it is resolved once to the `GroupID` the
  provider's own argument takes, so the identifier never reaches a link. Nothing
  in `teamSearchFrom` throws — an address may have been typed or sent by somebody
  else, so a month that is not a month becomes the month containing today rather
  than a blank screen with a stack trace behind it. And when the named group
  cannot be opened, the figures are shown unscoped with a notice saying the scope
  was dropped. It is not one of the states in `lib/state.ts` for that reason: an
  unreadable scope and an empty scoped report are different facts, and the reader
  came for the hours.
- **The key lists only the marks the table uses.** A legend entry for something
  that is nowhere on screen sends the reader hunting for it, and finding nothing
  is indistinguishable from having missed it. Read off the grid in
  `pages/team-hours/lib/legend.ts`. The reference bar is always listed: it
  explains every figure there is.
- **What an empty cell may claim follows the filter, and there are two strings
  for it.** Unnarrowed, the cell says "No hours logged anywhere." — the strongest
  claim this screen has ever made, and it is now sayable: `users(ids:)` with a
  `User`-parented `timelogs` reaches every hour GitLab will show this reader for
  that person, personal projects included, so nothing was left unasked. Narrowed
  to a group, it says "No hours in this group." — the original prohibition,
  verbatim, for the original reason: a group's connection is scoped by
  `Timelog.in_group` to that group and its descendants, so an hour logged on an
  issue elsewhere is not missing from the answer, it was never asked for. The
  cells used to read "No time logged" in both cases, which is a claim about a
  person made from a measurement of a group, and a reader who reaches the table
  by landmark never passes the subtitle that qualified it.
  Two keys — `team_cell_unlogged_anywhere` and `team_cell_unlogged_in_group` —
  not one with the group as a parameter: unnarrowed there is no group to
  substitute, and an empty parameter renders a sentence with a hole in it. The
  table caption carries the scope either way, so it is announced where the
  figures are rather than in a subtitle above them.
- **The team screen's sync control carries no caveats.** It answers three questions — when the
  hours arrived, whether they are arriving now, whether asking failed — and owns
  the screen's one status region. Sentences about what a figure could not include
  were appended to it and read as part of the sync state: announced on every
  refresh, and nowhere near the number they were about. They live on the row now.
  The reader's own access level is not explained at all: it is not something the
  screen measured, it does not change between visits, and it is not what somebody
  opened a month of hours to find out.
- **A withheld hour is added into its cell, not drawn beside it.** `model/withheld.ts`
  replaces the cell's figure with the provider's own total for that day and
  rebuilds every total from the summed cells, so the rows, the columns and the
  corner still agree. `share` is recomputed with it — a bar still drawn against
  the visible hours under a figure that grew would be the one mark on the screen
  disagreeing with the number beside it. The cell says what part of itself cannot
  be opened only to assistive technology: a bracketed second figure was tried and
  read as clutter, but a screen that folds an unreadable hour into a number and
  says nothing at all is vouching for something it cannot open.
- **Withheld hours are placed by asking the same aggregate one column at a
  time.** The entries are unrecoverable and always will be: `TimelogType`
  carries `authorize :read_issuable`, and a node the reader may not read is
  spliced out of the array — no id, no `spentAt`, nothing to recover. But
  `count` and `totalSpentTime` resolve over the finder relation _after_ the time
  filter and _before_ that removal, so the same instrument that says "3 h are
  missing from this month" says "3 h are missing from the 11th" when asked over
  one day. Asking is conditional on `shortfall.entryCount !== 0`, which the
  first round already answered for free — it carries a `count` beside the nodes,
  so a row whose count matches what arrived proves with no second request that
  nothing was removed from it. A team where the reader can open everything costs
  no extra request at all. One request per short row, capped at six, and only
  on a report narrowed to a group: unnarrowed nobody is asked, because almost
  every row is short there and marking six of them would mean nothing.
  A whole grid is not askable: each alias costs 7 of GitLab’s 250-point
  complexity budget, so a month of columns plus the period check scores 229 and
  fits, while forty columns score 292 and are refused. A team's grid is columns
  times people and is refused long before it reaches a database.
- **A placement is checked before it is drawn, and refusing costs only the
  marks.** `model/withheld.ts` requires the columns to account for the period
  exactly, no column to declare fewer entries than were shown in it, and the
  period to declare at least what the row draws. The first of those is what sees
  the provider reading a span differently from this app: rounded-out spans
  overlap and the sum comes in high, a span a millisecond short leaves a gap and
  it comes in low. Every check is on entry counts, never seconds, because counts
  cannot cancel — an entry and its correction net to zero seconds and remain two
  entries. No hour on screen depends on any of it: the figures still come from
  entries the pages carried, cut in the reader’s zone, and a refused placement
  leaves the row saying hours are missing without saying where.
- **The team report is never written to the device, and neither is the team.**
  Every query in the slice carries `meta: { persist: false }` — from
  `NOT_PERSISTED` in `shared/api`, one constant rather than a copy per slice,
  because it is a rule and a second copy is a second place to forget it —
  and `__root.tsx` reads that rather than a key it has to recognise. The reader's
  own hours are persisted because that is what paints a return visit before any
  request. These belong to other people, and a shared machine must not keep them.
  That covers the roster as much as the figures: a team is a list of colleagues'
  names, and writing one to IndexedDB is the same leak by a quieter route. The
  one thing kept across visits is the chosen team's identifier, which this app
  minted and which names nobody.
