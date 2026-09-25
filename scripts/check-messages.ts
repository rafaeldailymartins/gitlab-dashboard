/**
 * Every message exists in every language, and no message exists in only one.
 *
 * Paraglide compiles with `--silent`, so a key present in `en.json` and missing
 * from `pt-BR.json` produces a fallback rather than a warning: `bun run verify`
 * and the whole test suite stay green while a Portuguese reader is served
 * English. Nothing else in this repository catches that — `I18N-5` was listed as
 * "enforced by lint" for a rule that does not exist. This is the enforcement.
 *
 * The other direction matters too: a key left behind in one catalogue after the
 * interface stopped using it is dead weight that reads as a missing translation.
 *
 * And a key left in *every* catalogue after the interface stopped using it is
 * invisible to both of those checks, because parity with itself is perfect.
 * `team_people_count` and `team_loading_floor` survived a whole change that way.
 * `knip` cannot see them either — it reads modules, and a catalogue is data — so
 * the third check below is the only thing that can.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const SETTINGS = 'project.inlang/settings.json'
const MESSAGES = 'messages'
const SOURCE = 'src'

/** The compiled catalogue names every key, so scanning it would prove nothing. */
const GENERATED = `paraglide${path.sep}`

const SOURCE_FILE = /\.tsx?$/u

/**
 * `m.team_heading` and `m.team_heading()` both count.
 *
 * A message handed to a lookup table as a function reference — which is how
 * every theme, locale and sign-in-failure string is used — is used exactly as
 * much as one that is called on the spot, and a pattern that demanded the
 * parenthesis would report eight live keys as dead.
 */
const REFERENCE = /\bm\.(?<key>[\d_a-z]+)/gu

interface InlangSettings {
  readonly baseLocale: string
  readonly locales: readonly string[]
}

await main()

async function keysIn(file: string): Promise<readonly string[]> {
  const source = await readFile(file, 'utf8')

  return [...source.matchAll(REFERENCE)]
    .map((match) => match.groups?.['key'])
    .filter((key) => key !== undefined)
}

async function keysOf(locale: string): Promise<Set<string>> {
  const file = path.join(MESSAGES, `${locale}.json`)
  const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${file} is not an object`)
  }

  // `$schema` is the file's own metadata, not a message.
  return new Set(Object.keys(parsed).filter((key) => !key.startsWith('$')))
}

async function main(): Promise<void> {
  const settings = await readSettings()
  const base = await keysOf(settings.baseLocale)
  const problems: string[] = []

  for (const locale of settings.locales.filter((one) => one !== settings.baseLocale)) {
    problems.push(...(await parityProblems(base, locale, settings.baseLocale)))
  }

  problems.push(...unusedProblems(base, await referencedKeys()))

  report(problems, base.size, settings.locales.length)
}

async function parityProblems(
  base: ReadonlySet<string>,
  locale: string,
  baseLocale: string,
): Promise<readonly string[]> {
  const keys = await keysOf(locale)

  return [
    ...sorted([...base].filter((one) => !keys.has(one))).map(
      (key) => `${locale}: missing "${key}", so a reader of ${locale} is served ${baseLocale}`,
    ),
    ...sorted([...keys].filter((one) => !base.has(one))).map(
      (key) =>
        `${locale}: has "${key}", which ${baseLocale} does not — dead, or a rename left behind`,
    ),
  ]
}

async function readSettings(): Promise<InlangSettings> {
  const parsed: unknown = JSON.parse(await readFile(SETTINGS, 'utf8'))

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('baseLocale' in parsed) ||
    !('locales' in parsed) ||
    typeof parsed.baseLocale !== 'string' ||
    !Array.isArray(parsed.locales)
  ) {
    throw new Error(`${SETTINGS} declares no baseLocale and locales`)
  }

  return { baseLocale: parsed.baseLocale, locales: parsed.locales as readonly string[] }
}

async function referencedKeys(): Promise<ReadonlySet<string>> {
  const entries = await readdir(SOURCE, { recursive: true, withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && SOURCE_FILE.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !file.includes(GENERATED))

  const perFile = await Promise.all(files.map((file) => keysIn(file)))

  return new Set(perFile.flat())
}

function report(problems: readonly string[], keys: number, locales: number): void {
  if (problems.length > 0) {
    process.stderr.write(problems.map((problem) => `  ${problem}\n`).join(''))
    throw new Error(`${String(problems.length)} translation problem(s)`)
  }

  process.stdout.write(`${String(keys)} messages, complete in all ${String(locales)} languages\n`)
}

function sorted(keys: readonly string[]): readonly string[] {
  return keys.toSorted((one, other) => one.localeCompare(other))
}

function unusedProblems(
  base: ReadonlySet<string>,
  referenced: ReadonlySet<string>,
): readonly string[] {
  return sorted([...base].filter((one) => !referenced.has(one))).map(
    (key) => `"${key}" is in every catalogue and named nowhere under ${SOURCE}/ — delete it`,
  )
}
