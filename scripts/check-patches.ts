/**
 * Every patch `package.json` declares is applied to the version installed.
 *
 * Bun applies a patch to exactly the version its key names, and says nothing at
 * all when that version is not the one installed — `bun install
 * --frozen-lockfile` included. So a bump past a patched version drops the patch
 * silently. Dependabot's move of Vite from 8.2.2 to 8.3.3 did exactly that, with
 * every gate green and `AGENTS.md` promising the install would fail. This is
 * what fails instead, naming the patch, so the bump is the moment somebody
 * decides whether the fix is still needed rather than the week somebody notices
 * the dev server is slow again.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

interface Manifest {
  readonly patchedDependencies?: Readonly<Record<string, string>>
  readonly version?: string
}

await main()

async function installedVersion(name: string): Promise<string | undefined> {
  try {
    const installed = await readManifest(path.join('node_modules', name, 'package.json'))

    return installed.version
  } catch {
    return undefined
  }
}

async function main(): Promise<void> {
  const manifest = await readManifest('package.json')
  const patches = Object.entries(manifest.patchedDependencies ?? {})
  const problems: string[] = []

  for (const [key, patch] of patches) {
    // `lastIndexOf`, so a scoped `@scope/name@1.2.3` splits at its version.
    const at = key.lastIndexOf('@')
    const name = key.slice(0, at)
    const wanted = key.slice(at + 1)
    const installed = await installedVersion(name)

    if (installed !== wanted) {
      problems.push(
        `${patch} is for ${name}@${wanted}, and ${name}@${installed ?? '(nothing)'} is installed, ` +
          `so bun skips it without a word. Recreate it with \`bun patch ${name}\` if the fix ` +
          'is still needed upstream, or delete it and its entry if it is not.',
      )
    }
  }

  if (problems.length > 0) {
    process.stderr.write(problems.map((problem) => `  ${problem}\n`).join(''))
    throw new Error(`${String(problems.length)} patch(es) not applied`)
  }

  process.stdout.write(
    `${String(patches.length)} patch(es), each applied to the version installed\n`,
  )
}

async function readManifest(file: string): Promise<Manifest> {
  return JSON.parse(await readFile(file, 'utf8')) as Manifest
}
