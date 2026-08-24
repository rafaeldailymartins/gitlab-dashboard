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
    limit: '180 kB',
    name: 'initial load (every file index.html requests)',
    path: paths,
  },
]
