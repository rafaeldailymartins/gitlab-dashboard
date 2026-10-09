/**
 * The initial load, as `dist/index.html` actually defines it.
 *
 * This used to be a glob over `dist/assets/index-*.js`, which measured the entry
 * chunk and nothing else. When a shared module moved out of the entry into a
 * preloaded sibling, the recorded figure fell by 27 kB and the real initial load
 * did not move at all — the gate had simply stopped looking at part of it. So the
 * budget now reads the document: the entry script, every `modulepreload` the
 * bundler emitted beside it, and the stylesheet. A chunk cannot leave the
 * measurement without also leaving the page.
 */
import { readFileSync } from 'node:fs'

const REFERENCE = /(?:src|href)="\/(assets\/[^"]+)"/gu

const html = readFileSync('dist/index.html', 'utf8')
const paths = []

for (const match of html.matchAll(REFERENCE)) {
  if (match[1]) {
    paths.push(`dist/${match[1]}`)
  }
}

export default [
  {
    gzip: true,
    // 180 kB until 2026-10-09 (OBS-5). React 19.2.8 → 19.3.0 added 8.6 kB to
    // this load and zod 4.4.3 → 4.6.5 added 6.4 kB, each measured by reverting
    // that package alone, which took it from 179.53 kB to 195.55 kB. Holding both
    // back was the alternative, and the owner chose the budget instead:
    // `openspec/changes/archive/*-raise-the-initial-load-budget`. The headroom
    // left is half a kilobyte on purpose — the next addition meets the gate.
    limit: '196 kB',
    name: 'initial load (every file index.html requests)',
    path: paths,
  },
]
