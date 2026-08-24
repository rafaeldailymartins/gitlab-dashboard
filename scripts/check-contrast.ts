/**
 * Every colour pair that has to stay legible, measured rather than annotated.
 *
 * The token files used to carry their ratios in comments. A comment cannot fail:
 * `--muted-foreground` was documented at 7.2:1 and measured 5.96:1, and nothing
 * noticed. This reads the tokens straight out of the stylesheets and fails when a
 * pair drops below the floor its role answers to, so editing a token without
 * re-checking it is no longer possible.
 *
 * The pairs and their floors are in `contrast/pairs.ts`; the arithmetic is in
 * `contrast/measure.ts`.
 */
import { readFile } from 'node:fs/promises'

import type { Mode, Pair } from './contrast/pairs'

import { contrastOf } from './contrast/measure'
import { PAIRS } from './contrast/pairs'

const SHEETS = ['src/app/styles.css', 'src/app/charts.css']

const DECLARATION = /^--([\w-]+): (#[\da-f]{6});$/iu

/** A hundredth of tolerance, so a value that rounds to its floor is not a failure. */
const TOLERANCE = 0.005

type Palette = Record<Mode, Record<string, string>>

await main()

function failureFor(pair: Pair, palette: Palette): null | string {
  const scheme = palette[pair.mode]
  const foreground = scheme[pair.foreground]
  const background = scheme[pair.background]

  if (!foreground || !background) {
    const missing = foreground ? pair.background : pair.foreground

    return `${pair.mode}: ${pair.what} — no token named --${missing}`
  }

  const measured = contrastOf(foreground, background, pair.alpha ?? 1)

  if (measured + TOLERANCE >= pair.minimum) {
    return null
  }

  const alpha = pair.alpha === undefined ? '' : ` at ${String(pair.alpha)} alpha`

  return `${pair.mode}: ${pair.what} — ${foreground}${alpha} on ${background} is ${measured.toFixed(2)}:1, needs ${String(pair.minimum)}:1`
}

async function main(): Promise<void> {
  const palette = await readTokens()
  const problems = PAIRS.map((pair) => failureFor(pair, palette)).filter(
    (problem) => problem !== null,
  )

  report(problems)
}

/** Every `--token: #hex` in the `:root` and `.dark` blocks of both stylesheets. */
async function readTokens(): Promise<Palette> {
  const found: Palette = { dark: {}, light: {} }

  for (const sheet of SHEETS) {
    const file = await readFile(sheet, 'utf8')
    const source = file.replaceAll(/\/\*[\s\S]*?\*\//gu, '')

    for (const [mode, selector] of [
      ['light', ':root {'],
      ['dark', '.dark {'],
    ] as const) {
      Object.assign(found[mode], tokensIn(source, selector))
    }
  }

  return found
}

function report(problems: readonly string[]): void {
  if (problems.length > 0) {
    process.stderr.write(problems.map((problem) => `  ${problem}\n`).join(''))
    throw new Error(`${String(problems.length)} colour pair(s) below their floor`)
  }

  process.stdout.write(`${String(PAIRS.length)} colour pairs measured, all above their floor\n`)
}

/**
 * The declarations of one block, found by splitting rather than by a regular
 * expression: a pattern for "everything up to the closing brace" backtracks
 * badly, and these blocks are flat once comments are gone.
 */
function tokensIn(source: string, selector: string): Record<string, string> {
  const opened = source.split(selector)[1] ?? ''
  const block = opened.split('}', 1)[0] ?? ''
  const found: Record<string, string> = {}

  // One declaration per line, anchored at both ends: Prettier decides the
  // spacing in these files, so nothing here has to scan for it.
  for (const line of block.split('\n')) {
    const match = DECLARATION.exec(line.trim())

    if (match?.[1] && match[2]) {
      found[match[1]] = match[2].toLowerCase()
    }
  }

  return found
}
