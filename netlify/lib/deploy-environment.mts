export type Environment = 'development' | 'preview' | 'production' | 'staging' | 'unknown'

/**
 * The name a fault report gives the deploy it came from (OBS-7).
 *
 * One table for both runtimes. A function reads its deploy from the context the
 * platform hands it, as `storeNameFor` does; the bundle reads `CONTEXT` at build
 * time, through `vite.config.ts` importing this very function — which is why it
 * lives here, where both can reach it, and not in `src/`.
 *
 * `branch-deploy` is `staging` because the only branch deployed is `staging`
 * (CONTRIBUTING.md), and the tracker's filter should say what a reader of it
 * means rather than what the platform calls it.
 */
export function environmentFor(deployContext: unknown): Environment {
  switch (deployContext) {
    case 'branch-deploy': {
      return 'staging'
    }
    case 'deploy-preview': {
      return 'preview'
    }
    case 'dev': {
      return 'development'
    }
    case 'production': {
      return 'production'
    }
    default: {
      return 'unknown'
    }
  }
}
