import release from './release.json' with { type: 'json' }

/**
 * The commit this deploy was built from, as the functions report it (OBS-7).
 *
 * Not `process.env.COMMIT_REF`: Netlify sets that during the build and nowhere
 * else, and a function at run time is given only `URL`, `SITE_NAME` and
 * `SITE_ID`. So the build command in `netlify.toml` writes the commit into
 * `release.json` before the functions are bundled, and esbuild inlines it — the
 * same commit `vite.config.ts` defines into the bundle, which is what lets a
 * browser fault and a function fault from one deploy land under one release.
 *
 * The file in the repository carries an empty commit, so a local run, the tests
 * and `bun run dev` report under no release rather than under a stale one.
 */
export const RELEASE: string = release.commit
