/**
 * Compiles the message catalogues, and only when they have changed.
 *
 * Six scripts used to depend on this through `prelint`, `pretypecheck`,
 * `pretest`, `pretest:coverage`, `pretest:e2e` and `prebuild`, each paying 3.5
 * seconds to regenerate identical files — about twenty seconds across one full
 * pass of the gates. Worse than the cost: those writes are what made the gates
 * unsafe to run at the same time, since `src/paraglide/` is read by every static
 * analyser while the compiler rewrites it.
 *
 * So the compile is now guarded rather than removed. Every entry point still
 * asks for it and still gets correct output on a fresh clone — nothing calls
 * this differently than before — but asking twice costs a hash instead of a
 * rebuild, and nothing writes while the gates read.
 *
 * The fingerprint covers the catalogues, the project settings, the compiler
 * options and the compiler's own version. It also refuses to trust itself when
 * the output is missing: deleting `src/paraglide/` has to mean a rebuild, not a
 * stale stamp.
 */
import { createHash } from 'node:crypto'
import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const MESSAGES_DIR = 'messages'
const OUT_DIR = 'src/paraglide'
/** Absolute, as the CLI resolves it: the compiler records it in a generated
 * README, and a relative path there would be the one byte of output that
 * differed from what the command line produced. */
const PROJECT = path.resolve('project.inlang')
const SETTINGS = 'project.inlang/settings.json'

/** Written after a successful compile, inside the output it describes. */
const STAMP = path.join(OUT_DIR, '.fingerprint')

/** Proof the output is really there, not just recorded as having been there. */
const EMITTED = path.join(OUT_DIR, 'messages.js')

const VERSION = 'node_modules/@inlang/paraglide-js/package.json'

/**
 * The same options as the Vite plugin in `vite.config.ts`. They have to agree:
 * whichever runs last decides what the other one's consumers see.
 */
const OPTIONS = {
  emitTsDeclarations: true,
  isServer: 'false',
  outdir: `./${OUT_DIR}`,
  project: PROJECT,
  // Not `as const`: the compiler's own option type wants a mutable array, and a
  // readonly one is not assignable to it.
  strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
} satisfies Parameters<typeof import('@inlang/paraglide-js').compile>[0]

await main()

async function catalogues(): Promise<readonly string[]> {
  const entries = await readdir(MESSAGES_DIR)

  return entries
    .filter((entry) => entry.endsWith('.json'))
    .toSorted((one, other) => one.localeCompare(other))
    .map((entry) => path.join(MESSAGES_DIR, entry))
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)

    return true
  } catch {
    return false
  }
}

/** Everything that decides what the output should be. */
async function fingerprint(): Promise<string> {
  const hash = createHash('sha256')

  hash.update(JSON.stringify(OPTIONS))
  hash.update(await readFile(VERSION, 'utf8'))
  hash.update(await readFile(SETTINGS, 'utf8'))

  for (const file of await catalogues()) {
    hash.update(await readFile(file, 'utf8'))
  }

  return hash.digest('hex')
}

async function isCurrent(wanted: string): Promise<boolean> {
  if (!(await exists(EMITTED)) || !(await exists(STAMP))) {
    return false
  }

  const recorded = await readFile(STAMP, 'utf8')

  return recorded.trim() === wanted
}

async function main(): Promise<void> {
  const wanted = await fingerprint()

  if (await isCurrent(wanted)) {
    process.stdout.write('messages are current\n')

    return
  }

  // Imported here rather than at the top: the compiler is a large module, and
  // loading it to decide not to use it was most of what a skipped run cost.
  const { compile } = await import('@inlang/paraglide-js')

  await compile(OPTIONS)
  await writeFile(STAMP, wanted)
  process.stdout.write('messages compiled\n')
}
