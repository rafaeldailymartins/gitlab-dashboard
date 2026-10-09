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
 *
 * There is a second writer, and the two used to undo each other. `bun run dev`
 * compiles through the Vite plugin, which skips its own compile only when
 * `src/paraglide/` is byte for byte what it last wrote, and deletes whatever it
 * did not write. This wrote another output structure and kept its stamp inside
 * that folder, so every gate after a dev server rebuilt 391 files and the stamp
 * with them, and every dev server after a gate rebuilt them back and deleted
 * the stamp — a full compile on each side of every switch, which the `pre-push`
 * hook makes routine. So the output here is now exactly the plugin's in
 * development, and the stamp lives outside the folder the plugin owns.
 */
import { createHash } from 'node:crypto'
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const MESSAGES_DIR = 'messages'
const OUT_DIR = 'src/paraglide'
/** Relative, as `vite.config.ts` passes it: the compiler records it in a
 * generated README, and any other spelling there is one byte of output that
 * differs from the plugin's, which is enough to make it compile again. */
const PROJECT = './project.inlang'
const SETTINGS = 'project.inlang/settings.json'

/** Written after a successful compile, and outside the output it describes:
 * the Vite plugin deletes from `src/paraglide/` every file it did not write. */
const STAMP = 'node_modules/.cache/paraglide/fingerprint'

/** Proof the output is really there, and in this structure: only
 * `locale-modules` emits a module per locale, so after `vite build` has written
 * `message-modules` this is missing and the next gate compiles back. */
const EMITTED = path.join(OUT_DIR, 'messages', 'en.js')

const VERSION = 'node_modules/@inlang/paraglide-js/package.json'

/**
 * The same options as the Vite plugin in `vite.config.ts`, plus the structure
 * it chooses for itself under `bun run dev`. They have to agree byte for byte,
 * or each writer rebuilds the folder the other one just wrote.
 */
const OPTIONS = {
  emitTsDeclarations: true,
  isServer: 'false',
  outdir: `./${OUT_DIR}`,
  outputStructure: 'locale-modules',
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
  await mkdir(path.dirname(STAMP), { recursive: true })
  await writeFile(STAMP, wanted)
  process.stdout.write('messages compiled\n')
}
