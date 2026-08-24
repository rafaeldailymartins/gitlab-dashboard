/**
 * Every scenario cites a requirement, and every requirement is cited.
 *
 * A `# Spec:` comment is the only thread between an OpenSpec requirement and a
 * runnable assertion, and a thread that has gone slack says nothing while still
 * looking reassuring. This check fails in both directions: a scenario that cites
 * nothing, or cites something that does not exist, and a requirement that no
 * scenario claims to cover.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const CHANGE = 'openspec/changes/rebuild-personal-hours-dashboard'
const FEATURES = 'features'

/** `I18N-3` has a digit inside the capability prefix, so the class needs both. */
const REQUIREMENT = /^### Requirement: (?<id>[\dA-Z]+-\d+)/gmu
/** Matched against a trimmed line, so nothing here has to scan whitespace. */
const CITATION = /^# Spec: \S+ \/ (?<id>[\dA-Z]+-\d+)$/u
const SCENARIO_LINE = /^Scenario( Outline)?:/u

/**
 * Requirements no scenario can observe, with the reason. Each one is covered by
 * a gate rather than a test, or by a check a browser cannot make.
 */
const UNCITED_BY_DESIGN = new Map([
  [
    // This entry used to claim a lint rule that does not exist. Half of the
    // requirement is now a real gate; the other half is a review matter, and
    // saying so is better than crediting a check nobody wrote.
    'I18N-5',
    'A missing translation fails `bun run i18n:check`, which names the key and the language. A hardcoded literal is caught in review — no browser can tell a literal from a translation that happens to match.',
  ],
  [
    'PREF-5',
    'An inline script sets the theme before the bundle loads; a flash is a visual property no assertion can see.',
  ],
  ['PREF-6', 'A damaged store is covered by unit tests on the decoder.'],
  [
    'REPORT-1',
    'The gateway test proves the query names currentUser with no group or project, which is where the scoping lives.',
  ],
])

async function citations(): Promise<{ cited: Set<string>; problems: string[] }> {
  const cited = new Set<string>()
  const problems: string[] = []

  for (const feature of await filesUnder(FEATURES, '.feature')) {
    const text = await readFile(feature, 'utf8')
    const found = citationsIn(feature, text)

    for (const id of found.cited) {
      cited.add(id)
    }

    problems.push(...found.uncited)
  }

  return { cited, problems }
}

/**
 * The requirements one feature file cites, and the scenarios in it that cite
 * nothing. A scenario may cite more than one requirement; the next scenario
 * starts fresh, so a citation cannot drift down the file.
 */
function citationsIn(feature: string, text: string) {
  const cited: string[] = []
  const uncited: string[] = []
  let pending = 0

  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim()
    const id = CITATION.exec(line)?.groups?.['id']

    if (id !== undefined) {
      cited.push(id)
      pending += 1
    } else if (SCENARIO_LINE.test(line)) {
      if (pending === 0) {
        uncited.push(`${feature}:${String(index + 1)} — a scenario with no "# Spec:" comment`)
      }

      pending = 0
    }
  }

  return { cited, uncited }
}

async function declaredRequirements(): Promise<Set<string>> {
  const ids = new Set<string>()

  for (const spec of await filesUnder(path.join(CHANGE, 'specs'), '.md')) {
    const text = await readFile(spec, 'utf8')

    for (const match of text.matchAll(REQUIREMENT)) {
      const id = match.groups?.['id']

      if (id !== undefined) {
        ids.add(id)
      }
    }
  }

  return ids
}

async function filesUnder(directory: string, extension: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => path.join(entry.parentPath, entry.name))
}

const declared = await declaredRequirements()
const { cited, problems } = await citations()

for (const id of cited) {
  if (!declared.has(id)) {
    problems.push(`A scenario cites ${id}, which no specification declares`)
  }
}

for (const id of declared) {
  if (!cited.has(id) && !UNCITED_BY_DESIGN.has(id)) {
    problems.push(`${id} is declared but no scenario cites it`)
  }
}

for (const [id, reason] of UNCITED_BY_DESIGN) {
  if (!declared.has(id)) {
    problems.push(`${id} is listed as covered another way (${reason}) but no longer exists`)
  }
}

if (problems.length > 0) {
  const listed = problems.map((problem) => `  ${problem}`)

  process.stderr.write(listed.join('\n') + '\n')
  throw new Error(`Traceability is broken in ${String(problems.length)} place(s)`)
}

process.stdout.write(
  `${String(declared.size)} requirements, ${String(cited.size)} cited by scenarios, ` +
    `${String(UNCITED_BY_DESIGN.size)} covered another way\n`,
)
