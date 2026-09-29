/**
 * Every scenario cites a requirement, and every requirement is cited.
 *
 * A `# Spec:` comment is the only thread between an OpenSpec requirement and a
 * runnable assertion, and a thread that has gone slack says nothing while still
 * looking reassuring. This check fails in both directions: a scenario that cites
 * nothing, or cites something that does not exist, and a requirement that no
 * scenario claims to cover.
 */
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Where requirements live: the specs already merged, and every change that has
 * not been archived. Naming one change here — as this used to — meant the
 * second change's requirements were held to nothing at all, silently.
 */
const SPEC_ROOTS = ['openspec/specs', 'openspec/changes']
const ARCHIVED = path.join('changes', 'archive') + path.sep
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
    'AUTH-10',
    'The claim is about how many exchanges the provider is asked for, which no screen shows: a burst of callers must cost one token call and consume one rotating credential. `src/entities/sessions/api/session-manager.test.ts` proves it by counting them.',
  ],
  [
    'DELIVERY-1',
    "Which store a deploy files a reader's documents under is invisible to a browser, and the acceptance suite serves a static `dist/` that runs no function at all. `netlify/lib/store-name.test.mts` pins every deploy context to its store, and `netlify/lib/document-endpoint.test.mts` proves a deploy that cannot say what it is is refused without a store being asked for.",
  ],
  [
    'DELIVERY-2',
    'The paths into production are repository rules, not application behaviour. The `branch-policy` job in `.github/workflows/pull-request.yml` fails a pull request into `main` from anything but `staging` or `hotfix/*` of this repository, and the rulesets on `main` and `staging` make it and the other checks required.',
  ],
  [
    'DELIVERY-3',
    'A version is computed after the merge, from commit messages, by the `release` job in `.github/workflows/ci.yml` under the rules in `cliff.toml`; the `commit-messages` job in `.github/workflows/pull-request.yml` fails a pull request carrying a message those rules could not read. No screen shows a tag.',
  ],
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
  [
    'TEAM-3',
    "A browser cannot forge a credential or address another reader's key, so no scenario can observe the rule that makes naming somebody else’s teams unexpressible rather than merely refused. `netlify/lib/handle-document.test.mts` and `netlify/lib/identity.test.mts` prove it against the real handler in the `functions` Vitest project — which is also why the acceptance suite route-stubs the endpoint rather than running it: a stub cannot prove a rule it is itself implementing.",
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

  for (const spec of await specFiles()) {
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

async function exists(directory: string): Promise<boolean> {
  return access(directory).then(
    () => true,
    () => false,
  )
}

async function filesUnder(directory: string, extension: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => path.join(entry.parentPath, entry.name))
}

/**
 * Every `spec.md` outside the archive. The name is the filter: a proposal or a
 * design may quote a requirement heading, and only a specification declares one.
 *
 * A root that is not there holds no specifications. `openspec/specs` fills up
 * when a change is archived into it, and git does not track an empty directory
 * — so it exists in a working copy that has had one and not in a fresh clone,
 * which is what CI always has.
 */
async function specFiles(): Promise<string[]> {
  const found: string[] = []

  for (const root of SPEC_ROOTS) {
    if (!(await exists(root))) {
      continue
    }

    const files = await filesUnder(root, 'spec.md')

    found.push(...files.filter((file) => !file.includes(ARCHIVED)))
  }

  return found
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
