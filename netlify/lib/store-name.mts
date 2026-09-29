/**
 * Production's store. **Its name must never change**: a deploy that starts
 * reading somewhere else finds nothing there, and a missing document is
 * indistinguishable from a reader who never saved one.
 */
const PRODUCTION = 'readers'

/**
 * Every other deploy's — the `staging` branch deploy, every deploy preview, and
 * a local `netlify dev`. They share it: homologation is one place, however many
 * addresses it is reached at.
 */
const HOMOLOGATION = 'readers-staging'

export type StoreName = typeof HOMOLOGATION | typeof PRODUCTION

/**
 * The store a deploy files readers' documents under, or `null` for a deploy that
 * cannot say what it is (DELIVERY-1).
 *
 * Read from the context the platform hands the function, because at run time
 * there is nothing else: `CONTEXT` is a build-time variable, and a function is
 * given only `URL`, `SITE_NAME` and `SITE_ID`, none of which says which deploy
 * it belongs to.
 *
 * **Anything unrecognised names no store**, and the endpoint refuses. Guessing
 * production would let homologation write over readers' documents in silence;
 * guessing homologation would show every reader in production an empty list of
 * teams they did make. A refusal is loud either way, and the release checklist
 * reads production's teams straight after a deploy, which is where a value the
 * platform changed would show.
 */
export function storeNameFor(deployContext: unknown): null | StoreName {
  switch (deployContext) {
    case 'branch-deploy':
    case 'deploy-preview':
    case 'dev': {
      return HOMOLOGATION
    }
    case 'production': {
      return PRODUCTION
    }
    default: {
      return null
    }
  }
}
