import {
  gitLabAuthGateway,
  pendingAuthorizationStore,
  sessionManager,
  type SessionManager,
  sessionStore,
} from '@/entities/sessions'
import { gitLabTimelogGateway, type TimelogGateway } from '@/entities/timelogs'
import { graphQLClient } from '@/shared/api'
import { gitLabConfig, type GitLabConfig } from '@/shared/config'
import { persistentStorage } from '@/shared/lib/storage'

/** Where GitLab sends the reader back to, on whatever origin this is served from. */
const CALLBACK_PATH = '/auth/callback'

const GRAPHQL_PATH = '/api/graphql'

export type AppRuntime =
  | { readonly kind: 'missing-client-id' }
  | {
      readonly kind: 'ready'
      readonly manager: SessionManager
      readonly timelogs: TimelogGateway
    }

/**
 * Built once for the page.
 *
 * It is a module singleton because the router's route guards run outside React
 * and still have to ask whether a session exists. Component tests build their
 * own manager and gateway instead of reaching for these.
 */
export const appRuntime: AppRuntime = createRuntime()

/**
 * The redirect URI this origin needs registered in GitLab. Shown to the reader
 * when the build has no application id, so they can copy it verbatim.
 */
export function callbackUri(): string {
  return new URL(CALLBACK_PATH, globalThis.location.origin).toString()
}

/** True when a session can be resumed without asking GitLab again. */
export function hasSession(): boolean {
  return appRuntime.kind === 'ready' && appRuntime.manager.hasSession()
}

/** Sends the browser to GitLab. Separated so a test never navigates. */
export function navigateAway(url: string): void {
  globalThis.location.assign(url)
}

function createRuntime(): AppRuntime {
  const result = gitLabConfig()

  if (result.kind === 'missing-client-id') {
    return { kind: 'missing-client-id' }
  }

  const manager = createSessionManager(result.config)

  return {
    kind: 'ready',
    manager,
    // The manager is the credential: it hands out an access token and knows how
    // to renew one, which is all the data client asks of a session.
    timelogs: gitLabTimelogGateway(graphQLClient(result.config.baseUrl + GRAPHQL_PATH, manager)),
  }
}

function createSessionManager(config: GitLabConfig): SessionManager {
  const storage = persistentStorage()

  return sessionManager({
    gateway: gitLabAuthGateway(config, callbackUri()),
    now: () => Date.now(),
    pending: pendingAuthorizationStore(storage),
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
    sha256: async (input) =>
      new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input)),
    store: sessionStore(storage),
  })
}
