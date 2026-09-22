# Design

## What is actually given up

The two removed rules were both protections against a **silent absence**:
somebody who belongs on the team and is not offered. That failure still exists —
the window is still thirty days and the read still stops at four pages — so the
honest question is what covers it now.

The answer is the shape of the surface. Under the old flow the reader's next
action was to scan a list of candidates and click plus beside each one; if a name
was missing, nothing on screen distinguished "they logged nothing" from "we
stopped reading". Under this one, the reader's next action is to look at the
team, which is already made, and the search that finds anybody by name — logged
or not, inside the group or outside it — is a field sitting under it, always
open. A missing colleague is one thing to notice and one place to fix.

That is weaker than a sentence saying so. It is not nothing, and it is what the
reader asked for, knowing the trade.

## What is deliberately kept

`SuggestionAnswer.partial` stays on the port and `readSuggestions` still sets it,
tested at the cap in `suggestion-reader.test.ts`. It is a true fact about the
read, and the cheapest way to say it again later is to have never stopped
computing it. What changed is that nothing renders it — the fact stops at
`useGroupSeeding`, with the reason written there.

`WINDOW_DAYS` is likewise unchanged and still documented in the hook. A reader
looking for why somebody is missing will find the number in the code; what they
will not find is that number in the middle of a sentence explaining a button.

## The dialog's description

"A team is a list of people you keep. A month of hours covers everyone on it,
wherever they logged the time." — two sentences, the second of which is about the
report and not about this dialog. It is replaced by one sentence that says what
the reader gets: a list of people whose hours logged in GitLab they can follow.
