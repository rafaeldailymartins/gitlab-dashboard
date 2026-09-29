# delivery Specification

## Purpose

How a change reaches the people reading their hours: through a homologation
environment whose documents are its own, by the only two paths into production,
and as a version computed from the commits it carries.

## Requirements

### Requirement: DELIVERY-1 — Homologation keeps documents of its own

Every deploy that is not production SHALL read and write readers' teams and
schedules in a store of its own, and SHALL NOT read or write production's. That
covers the homologation deploy and every deploy preview: they share one store
between them, and production shares it with nothing. A roster is a list of
colleagues, and homologation is where something broken is tried on purpose.

Production's store SHALL keep the name and the location it has. A deploy that
starts reading somewhere else finds nothing there, and a missing document is
indistinguishable from a reader who never saved one — every reader's teams would
be gone with no error anywhere.

Homologation SHALL start empty. Nothing is copied into it from production.

A deploy SHALL be treated as production only when the platform says it is, and a
request on a deploy that cannot say what it is SHALL be refused as unavailable,
with no store read or written. Guessing either way is worse than refusing: guessed
production lets homologation write over readers' documents, and guessed
homologation shows every reader in production an empty list of teams they did
make.

#### Scenario: A team saved in homologation

- **WHEN** a reader saves a team on the homologation deploy
- **AND** the same reader opens production
- **THEN** that team is not listed in production

#### Scenario: Production's teams are not in homologation

- **WHEN** a reader who has teams in production opens homologation for the first
  time
- **THEN** no team is listed

#### Scenario: A deploy preview is homologation

- **WHEN** a reader saves a team on a deploy preview
- **THEN** the team is listed on the homologation deploy
- **AND** it is not listed in production

#### Scenario: A deploy that cannot say what it is

- **WHEN** a request reaches a document endpoint on a deploy whose kind cannot be
  established
- **THEN** the request is refused as unavailable
- **AND** no store is read or written

### Requirement: DELIVERY-2 — A change reaches production through homologation, or as a hotfix

Production SHALL be deployed from `main` and from nothing else, and a change SHALL
enter `main` only by a pull request from `staging` — a promotion — or from a
branch named `hotfix/*` in this repository. Any other pull request into `main`
SHALL fail a check the pull request cannot be merged without. A branch in a fork
SHALL NOT count as `staging` or as a hotfix, whatever it is named.

Every other change SHALL enter `staging` by a pull request. A fix that reached
`main` as a hotfix SHALL be brought into `staging` by a pull request from `main`,
so that homologation never lacks something production has.

Every pull request, into either branch, SHALL pass the same checks before it can
be merged, and the commit at the head of `staging` SHALL carry those checks, so
that a promotion is judged on checks its own head already passed. Pull requests
SHALL be merged with a merge commit, never squashed or rebased: rewriting what
`staging` carried would make the next promotion propose it again.

Homologation SHALL be deployed from `staging` at an address that does not change
from one change to the next, and a reader SHALL be able to sign in there.

#### Scenario: A promotion

- **WHEN** a pull request into `main` comes from `staging`
- **THEN** the branch check passes

#### Scenario: A hotfix

- **WHEN** a pull request into `main` comes from a branch of this repository
  named `hotfix/fix-the-login-loop`
- **THEN** the branch check passes

#### Scenario: A feature aimed at production

- **WHEN** a pull request into `main` comes from a branch named
  `feat/export-a-month`
- **THEN** the branch check fails
- **AND** the pull request cannot be merged

#### Scenario: A fork's branch named staging

- **WHEN** a pull request into `main` comes from a branch named `staging` in a
  fork of this repository
- **THEN** the branch check fails

#### Scenario: Bringing a hotfix back

- **WHEN** a pull request into `staging` comes from `main`
- **THEN** the branch check passes

#### Scenario: Signing in on homologation

- **WHEN** a reader signs in on the homologation address
- **THEN** GitLab returns them to the homologation address, signed in

### Requirement: DELIVERY-3 — Every merge into production is a version with notes

Every merge into `main` SHALL be released: a tag `vMAJOR.MINOR.PATCH` and notes
generated from the commits since the previous version, grouped by kind and
written in English. It SHALL happen only after the checks on that commit of
`main` have passed, and a merge whose checks fail SHALL publish nothing. Two
merges close enough together that the second arrives while the first is still
being checked MAY be released as one version; no commit merged into `main` SHALL
be left out of every release's notes.

The version SHALL be computed from those commits and from nothing typed by hand:
a commit marked as breaking raises the major version, otherwise a feature raises
the minor version, otherwise the patch version is raised. A promotion carrying
only documentation, tests or tooling is still a release, and a patch.

The first version SHALL be `v2.0.0`, marking `main` as it stood before this
change took effect. The version SHALL be written in the tags and nowhere else: no
file in the repository carries it, so there is no second copy to fall behind.

Every commit a pull request brings SHALL have a message in Conventional Commits
form, checked before the merge; a pull request carrying one that is not SHALL
fail a check it cannot be merged without, naming the commit. Merge commits are
exempt: nothing reads their messages to build the notes.

#### Scenario: A promotion carrying a feature

- **WHEN** the last version is `v2.0.0`
- **AND** `staging` is promoted with a commit of kind `feat` among those it
  brings
- **THEN** `v2.1.0` is tagged and released
- **AND** its notes list that commit under features

#### Scenario: A hotfix

- **WHEN** the last version is `v2.1.0`
- **AND** a hotfix whose only commit is of kind `fix` is merged into `main`
- **THEN** `v2.1.1` is tagged and released

#### Scenario: A breaking change

- **WHEN** the last version is `v2.1.1`
- **AND** a promotion brings a commit marked as breaking
- **THEN** `v3.0.0` is tagged and released

#### Scenario: A promotion of housekeeping only

- **WHEN** the last version is `v3.0.0`
- **AND** every commit a promotion brings is of kind `docs`, `test`, `ci` or
  `chore`
- **THEN** `v3.0.1` is tagged and released

#### Scenario: Checks that fail on main

- **WHEN** the checks on a merge into `main` fail
- **THEN** no version is tagged or released

#### Scenario: A commit message that is not conventional

- **WHEN** a pull request carries a commit whose message is `fixed stuff`
- **THEN** the commit-message check fails and names that commit
- **AND** the pull request cannot be merged
