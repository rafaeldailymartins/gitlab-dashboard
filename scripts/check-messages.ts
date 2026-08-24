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
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const SETTINGS = 'project.inlang/settings.json'
const MESSAGES = 'messages'

interface InlangSettings {
  readonly baseLocale: string
  readonly locales: readonly string[]
}

await main()

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
    const keys = await keysOf(locale)

    for (const key of [...base]
      .filter((one) => !keys.has(one))
      .toSorted((one, other) => one.localeCompare(other))) {
      problems.push(
        `${locale}: missing "${key}", so a reader of ${locale} is served ${settings.baseLocale}`,
      )
    }

    for (const key of [...keys]
      .filter((one) => !base.has(one))
      .toSorted((one, other) => one.localeCompare(other))) {
      problems.push(
        `${locale}: has "${key}", which ${settings.baseLocale} does not — dead, or a rename left behind`,
      )
    }
  }

  report(problems, base.size, settings.locales.length)
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

function report(problems: readonly string[], keys: number, locales: number): void {
  if (problems.length > 0) {
    process.stderr.write(problems.map((problem) => `  ${problem}\n`).join(''))
    throw new Error(`${String(problems.length)} translation problem(s)`)
  }

  process.stdout.write(`${String(keys)} messages, complete in all ${String(locales)} languages\n`)
}
