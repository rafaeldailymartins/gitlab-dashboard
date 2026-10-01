/**
 * Prints the dependency snapshot of `bun.lock`, for GitHub's dependency
 * submission API.
 *
 * GitHub's dependency graph reads `package.json` and not `bun.lock`: it listed
 * the seventy-odd packages this project names and none of the thirteen hundred
 * they bring in. So Dependabot alerts and the `dependency-review` check were
 * blind to exactly the packages `bun audit` keeps finding advisories in —
 * fast-uri's two high ones were transitive. Submitting the lockfile is what
 * makes both of them see the tree that is actually installed.
 *
 * Every package is marked `direct` or `indirect`, and `runtime` when something
 * the shipped code depends on reaches it, `development` otherwise. The review
 * fails on both scopes, like `bun audit`; the scope is there so an alert says
 * whether the package reaches a reader's browser.
 *
 * The commit and ref come from `SNAPSHOT_SHA` and `SNAPSHOT_REF`, because a
 * pull request's snapshot belongs to its head commit, not to the merge commit
 * the run is checked out at.
 */
import { readFile } from 'node:fs/promises'

const LOCKFILE = 'bun.lock'

/** A version this can name as a purl; `workspace:`, `github:` and `file:` are not. */
const REGISTRY_VERSION = /^\d/u

/** Strings are matched first, so a comma inside one is never touched. */
const TRAILING_COMMA = /("(?:[^"\\]|\\.)*")|,(?=\s*[\]}])/gu

type DependencyField =
  'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies'

interface Lockfile {
  readonly packages: Readonly<Record<string, readonly [string, ...unknown[]]>>
  readonly workspaces: Readonly<Record<string, Manifest>>
}

type Manifest = Readonly<Partial<Record<DependencyField, Readonly<Record<string, string>>>>>

interface Resolved {
  readonly dependencies: string[]
  readonly package_url: string
  relationship: 'direct' | 'indirect'
  scope: Scope
}

type Scope = 'development' | 'runtime'

interface Walk {
  readonly lock: Lockfile
  readonly resolved: Map<string, Resolved>
}

const RUNTIME_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'] as const
const ALL_FIELDS = [...RUNTIME_FIELDS, 'devDependencies'] as const

await main()

function dependencyNames(lock: Lockfile, key: string): string[] {
  const info = lock.packages[key]?.[2] as Manifest | undefined

  return ALL_FIELDS.flatMap((field) => Object.keys(info?.[field] ?? {}))
}

/** Bun nests a package under the one that needed a different version of it. */
function lockedKey(lock: Lockfile, from: string, name: string): string | undefined {
  for (let prefix = from; prefix !== ''; prefix = parentOf(prefix)) {
    if (`${prefix}/${name}` in lock.packages) {
      return `${prefix}/${name}`
    }
  }

  return name in lock.packages ? name : undefined
}

async function main(): Promise<void> {
  const lock = parse(await readFile(LOCKFILE, 'utf8'))
  const root = lock.workspaces[''] ?? {}
  const resolved = resolve(lock, root)

  process.stdout.write(JSON.stringify(snapshot(resolved)))
}

function namesIn(manifest: Manifest, fields: readonly DependencyField[]): string[] {
  return fields.flatMap((field) => Object.keys(manifest[field] ?? {}))
}

/** `@babel/core/semver` → `@babel/core`; a scope travels with its name. */
function parentOf(key: string): string {
  const segments = key.split('/')

  segments.pop()
  if (segments.at(-1)?.startsWith('@') === true) {
    segments.pop()
  }

  return segments.join('/')
}

function parse(source: string): Lockfile {
  const json = source.replaceAll(TRAILING_COMMA, (_match, text: string | undefined) => text ?? '')

  return JSON.parse(json) as Lockfile
}

/** The purl of a locked package, or null for one no registry serves. */
function purlOf(lock: Lockfile, key: string): null | string {
  const ident = lock.packages[key]?.[0]
  const at = ident?.lastIndexOf('@') ?? -1

  if (ident === undefined || at <= 0 || !REGISTRY_VERSION.test(ident.slice(at + 1))) {
    return null
  }

  return `pkg:npm/${ident.slice(0, at).replace(/^@/u, '%40')}@${ident.slice(at + 1)}`
}

function record(
  resolved: Map<string, Resolved>,
  found: { children: (null | string | undefined)[]; direct: boolean; purl: string; scope: Scope },
): void {
  const entry = resolved.get(found.purl) ?? {
    dependencies: [],
    package_url: found.purl,
    relationship: 'indirect',
    scope: found.scope,
  }

  if (found.direct) {
    entry.relationship = 'direct'
  }
  if (found.scope === 'runtime') {
    entry.scope = 'runtime'
  }
  for (const child of found.children) {
    if (child && !entry.dependencies.includes(child)) {
      entry.dependencies.push(child)
    }
  }
  resolved.set(found.purl, entry)
}

function required(name: string): string {
  const value = process.env[name]

  if (value === undefined || value === '') {
    throw new Error(`${name} is not set`)
  }

  return value
}

function resolve(lock: Lockfile, root: Manifest): Map<string, Resolved> {
  const resolved = new Map<string, Resolved>()

  walk({ lock, resolved }, namesIn(root, ['devDependencies']), 'development')
  walk({ lock, resolved }, namesIn(root, RUNTIME_FIELDS), 'runtime')

  return resolved
}

function snapshot(resolved: Map<string, Resolved>): unknown {
  return {
    detector: {
      name: 'gitlab-dashboard bun.lock',
      url: `${required('GITHUB_SERVER_URL')}/${required('GITHUB_REPOSITORY')}/blob/main/scripts/dependency-snapshot.ts`,
      version: '1',
    },
    job: { correlator: LOCKFILE, id: required('GITHUB_RUN_ID') },
    manifests: {
      [LOCKFILE]: {
        file: { source_location: LOCKFILE },
        name: LOCKFILE,
        resolved: Object.fromEntries(resolved),
      },
    },
    ref: required('SNAPSHOT_REF'),
    scanned: new Date().toISOString(),
    sha: required('SNAPSHOT_SHA'),
    version: 0,
  }
}

/** Breadth first from the names the project declares; runtime overrides development. */
function walk({ lock, resolved }: Walk, names: string[], scope: Scope): void {
  const queue = names.map((name) => ({ direct: true, key: lockedKey(lock, '', name) }))
  const seen = new Set<string>()

  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const { direct, key } = next
    const purl = key === undefined ? null : purlOf(lock, key)

    if (key === undefined || purl === null || seen.has(key)) {
      continue
    }
    seen.add(key)
    const children = dependencyNames(lock, key).map((name) => lockedKey(lock, key, name))

    record(resolved, {
      children: children.map((child) => child && purlOf(lock, child)),
      direct,
      purl,
      scope,
    })
    queue.push(...children.map((child) => ({ direct: false, key: child })))
  }
}
