import {
  gitLabAuthGateway,
  pendingAuthorizationStore,
  sessionManager,
  type SessionManager,
  sessionStore,
} from '@/entities/sessions'
import { gitLabConfig } from '@/shared/config'
import { persistentStorage } from '@/shared/lib/storage'

/** Where GitLab sends the reader back to, on whatever origin this is served from. */
const CALLBACK_PATH = '/auth/callback'

export type SessionRuntime =
  | { readonly kind: 'missing-client-id' }
  | { readonly kind: 'ready'; readonly manager: SessionManager }

/**
 * Built once for the page.
 *
 * It is a module singleton because the router's route guards run outside React
 * and still have to ask whether a session exists. Component tests build their
 * own manager instead of reaching for this one.
 */
export const sessionRuntime: SessionRuntime = createRuntime()

/**
 * The redirect URI this origin needs registered in GitLab. Shown to the reader
 * when the build has no application id, so they can copy it verbatim.
 */
export function callbackUri(): string {
  return new URL(CALLBACK_PATH, globalThis.location.origin).toString()
}

/** True when a session can be resumed without asking GitLab again. */
export function hasSession(): boolean {
  return sessionRuntime.kind === 'ready' && sessionRuntime.manager.hasSession()
}

/** Sends the browser to GitLab. Separated so a test never navigates. */
export function navigateAway(url: string): void {
  globalThis.location.assign(url)
}

function createRuntime(): SessionRuntime {
  const result = gitLabConfig()

  if (result.kind === 'missing-client-id') {
    return { kind: 'missing-client-id' }
  }

  const storage = persistentStorage()

  return {
    kind: 'ready',
    manager: sessionManager({
      gateway: gitLabAuthGateway(
        result.config,
        new URL(CALLBACK_PATH, globalThis.location.origin).toString(),
      ),
      now: () => Date.now(),
      pending: pendingAuthorizationStore(storage),
      randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
      sha256: async (input) =>
        new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input)),
      store: sessionStore(storage),
    }),
  }
}
