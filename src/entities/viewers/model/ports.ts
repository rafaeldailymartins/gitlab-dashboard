/** Who the credential belongs to, as far as this app needs to know. */
export interface Viewer {
  readonly name: string
}

/**
 * Reads the signed-in person's own identity.
 *
 * Separate from the timelog gateway on purpose: the settings screen wants a name
 * and no hours, and asking the hours query for it would make that screen load a
 * season of history to write one word.
 */
export interface ViewerGateway {
  /** Null when the provider accepted the credential but resolved nobody behind it. */
  me: (signal?: AbortSignal) => Promise<null | Viewer>
}
