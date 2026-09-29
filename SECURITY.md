# Security policy

GitLab Dashboard signs people in with their GitLab account and keeps the teams
and working schedules they define. A flaw here can expose somebody's session or
somebody else's colleagues, so reports are welcome and taken seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Report it privately instead:

1. Open the repository's
   [Security tab](https://github.com/rafaeldailymartins/gitlab-dashboard/security)
   and choose **Report a vulnerability**.
2. Describe what you found, how to reproduce it, and what an attacker could do
   with it. A proof of concept against your own account is ideal.

The report stays private between you and the maintainer until a fix is
released. This project is maintained by one person, so replies are best effort,
and every report gets one.

## Supported versions

Only the [latest release](https://github.com/rafaeldailymartins/gitlab-dashboard/releases/latest),
which is what https://gitlabdashboard.netlify.app runs. Fixes are not
backported.

## Scope

In scope:

- The sign-in flow (OAuth with PKCE) and how the tokens are held.
- The two endpoints, `/.netlify/functions/teams` and
  `/.netlify/functions/preferences`: reading or writing another reader's
  documents, or getting past the identity check.
- The Content-Security-Policy, and anything that runs script on the app's
  origin.
- Data about other people left on the device after a visit.

Out of scope:

- GitLab itself; report those to [GitLab](https://about.gitlab.com/security/disclosure/).
- The Netlify platform, and denial of service by volume.
- Anything that needs a compromised device, browser or extension.

What the app stores, and where, is described in the README's
[Security and privacy](README.md#-security-and-privacy) section.
