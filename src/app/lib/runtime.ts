import {
  gitLabAuthGateway,
  pendingAuthorizationStore,
  sessionManager,
  type SessionManager,
  sessionStore,
} from '@/entities/sessions'
import { gitLabTimelogGateway, type TimelogGateway } from '@/entities/timelogs'
import { gitLabViewerGateway, type ViewerGateway } from '@/entities/viewers'
import { type GraphQLClient, graphQLClient } from '@/shared/api'
import { gitLabConfig, type GitLabConfig } from '@/shared/config'
import { persistentStorage } from '@/shared/lib/storage'

/** Where GitLab sends the reader back to, on whatever origin this is served from. */
const CALLBACK_PATH = '/auth/callback'

const GRAPHQL_PATH = '/api/graphql'

export type AppRuntime =
  | {
      /**
       * The data client behind the session.
       *
       * Handed out rather than another gateway beside the two below, so a
       * screen most readers never open does not put its adapter in the bundle
       * everybody downloads. The team screen builds its own from this.
       */
      readonly client: GraphQLClient
      readonly kind: 'ready'
      readonly manager: SessionManager
      readonly timelogs: TimelogGateway
      readonly viewer: ViewerGateway
    }
  | { readonly kind: 'missing-client-id' }

/**
 * Built once for the page.
 *
 * It is a module singleton because the router's route guards run outside React
 * and still have to ask whether a session exists. Component tests build their
 * own manager and gateway instead of reaching for these.
 */
export const appRuntime: AppRuntime = createRuntime()

/**
 * The data client behind the session.
 *
 * @throws Error when the build has no application id. Every caller sits behind
 *   the session guard, which cannot pass without a configured runtime, so this
 *   is a contract rather than a case a screen has to render.
 */
export function apiClient(): GraphQLClient {
  if (appRuntime.kind !== 'ready') {
    throw new Error('apiClient was called before GitLab was configured')
  }

  return appRuntime.client
}

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
  // The manager is the credential: it hands out an access token and knows how to
  // renew one, which is all the data client asks of a session. One client serves
  // both gateways, so one renewal covers both.
  const client = graphQLClient(result.config.baseUrl + GRAPHQL_PATH, manager)

  return {
    client,
    kind: 'ready',
    manager,
    timelogs: gitLabTimelogGateway(client),
    viewer: gitLabViewerGateway(client),
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
