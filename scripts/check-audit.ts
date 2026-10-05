/**
 * Dependency advisories, judged in two tiers.
 *
 * **What a reader runs: zero, at any severity, no exceptions.** The browser
 * bundle and the functions hold a GitLab credential, and other people's names
 * and hours. `bun audit --prod` covers that tree, and nothing can be excused in
 * it.
 *
 * **What only builds, lints and tests: zero that nobody has accounted for.**
 * The tooling tree is ten times the size, and an advisory there can have no
 * fixed release and no path to a reader — `braces` was the first: a stack
 * exhaustion from a glob pattern nobody but this repository writes. Failing on
 * it turned every gate red with nothing anybody could do, and a gate that is red
 * for no action teaches people to stop reading it. So an advisory there may be
 * accepted in `scripts/audit/accepted.ts`, with its reason and its review date,
 * and anything not on that list still fails.
 *
 * `--prod` is not listed by `bun audit --help`, so the gate does not take it on
 * trust: if it ever stopped filtering, the production tier would quietly become
 * the whole tree audited with no exceptions — or, worse, nothing at all. The
 * package counts of the two runs are compared, and a production tier that is not
 * strictly smaller than the whole tree fails.
 */
import { spawnSync } from 'node:child_process'

import { ACCEPTED, type AcceptedAdvisory } from './audit/accepted'

/** How long an accepted advisory may go without somebody checking its reason. */
const REVIEW_DAYS = 90

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** `checked 92 packages` — the only place the audit says how much it read. */
const CHECKED = /checked (?<count>\d+) packages/u

const ADVISORY_ID = /(?<id>GHSA(?:-[\da-z]{4}){3})/u

interface Found {
  readonly advisory: string
  readonly package: string
  readonly severity: string
  readonly title: string
}

interface Run {
  readonly output: string
  readonly status: number
}

main()

function advisoriesOf(json: string): Found[] {
  const parsed: unknown = JSON.parse(json.slice(json.indexOf('{')))

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('bun audit --json did not answer with an object')
  }

  return Object.entries(parsed).flatMap(([name, advisories]) =>
    (Array.isArray(advisories) ? advisories : []).map((advisory: unknown) =>
      foundOf(name, advisory),
    ),
  )
}

function audit(flags: readonly string[]): Run {
  // `process.execPath` is Bun itself, which `bun --bun` guarantees, so the
  // audit runs on the same Bun this script does whatever PATH holds.
  const run = spawnSync(process.execPath, ['audit', ...flags], { encoding: 'utf8' })

  return { output: run.stdout, status: run.status ?? 1 }
}

function countOf(run: Run): number {
  const count = CHECKED.exec(run.output)?.groups?.['count']

  if (count === undefined) {
    throw new Error(`bun audit no longer says how many packages it checked:\n${run.output}`)
  }

  return Number(count)
}

function foundOf(name: string, advisory: unknown): Found {
  const record = typeof advisory === 'object' && advisory !== null ? advisory : {}
  const field = (key: string): string =>
    key in record ? String((record as Record<string, unknown>)[key]) : ''

  return {
    advisory: ADVISORY_ID.exec(field('url'))?.groups?.['id'] ?? field('id'),
    package: name,
    severity: field('severity'),
    title: field('title'),
  }
}

function isAccepted(found: Found, entry: AcceptedAdvisory): boolean {
  return entry.advisory === found.advisory && entry.package === found.package
}

function main(): void {
  const production = audit(['--prod'])
  const tooling = advisoriesOf(audit(['--json']).output)
  const whole = audit(ACCEPTED.map((entry) => `--ignore=${entry.advisory}`))
  const problems = [
    ...productionProblems(production),
    ...unaccountedProblems(tooling),
    ...staleProblems(tooling),
    ...overdueProblems(new Date()),
    ...scopeProblems(production, whole),
  ]

  if (problems.length > 0) {
    process.stderr.write(problems.map((problem) => `  ${problem}\n`).join(''))
    throw new Error(`${String(problems.length)} audit problem(s)`)
  }

  const accepted = ACCEPTED.map((entry) => [entry.package, entry.advisory].join(' ')).join(', ')

  process.stdout.write(
    `production: ${String(countOf(production))} packages, no advisories\n` +
      `tooling: ${String(countOf(whole))} packages, ${String(ACCEPTED.length)} accepted (${accepted})\n`,
  )
}

function overdueProblems(today: Date): string[] {
  return ACCEPTED.filter(
    (entry) =>
      today.getTime() - Date.parse(`${entry.reviewed}T00:00:00Z`) > REVIEW_DAYS * MS_PER_DAY,
  ).map(
    (entry) =>
      `${entry.package} ${entry.advisory} was last reviewed on ${entry.reviewed}, over ${String(REVIEW_DAYS)} days ago — check its reason still holds and move the date`,
  )
}

function productionProblems(production: Run): string[] {
  if (production.status === 0) {
    return []
  }

  return [
    `a production dependency has an advisory, and none can be accepted there:\n${production.output}`,
  ]
}

function scopeProblems(production: Run, whole: Run): string[] {
  if (whole.status !== 0) {
    // Reported by `unaccountedProblems`, which names the advisory.
    return []
  }

  return countOf(production) < countOf(whole)
    ? []
    : [
        `bun audit --prod checked ${String(countOf(production))} packages of ${String(countOf(whole))}: it is no longer filtering to production`,
      ]
}

function staleProblems(tooling: readonly Found[]): string[] {
  return ACCEPTED.filter((entry) => !tooling.some((found) => isAccepted(found, entry))).map(
    (entry) =>
      `${entry.package} ${entry.advisory} is accepted in scripts/audit/accepted.ts but no longer reported — delete the entry`,
  )
}

function unaccountedProblems(tooling: readonly Found[]): string[] {
  return tooling
    .filter((found) => !ACCEPTED.some((entry) => isAccepted(found, entry)))
    .map(
      (found) =>
        `${found.package}: ${found.severity} ${found.advisory} — ${found.title}. Upgrade it (bun audit fix), or, only if no release fixes it and it cannot reach a reader, accept it in scripts/audit/accepted.ts with the reason`,
    )
}
