import type { Viewer } from './ports'

/**
 * The name to greet someone by: the first word of what they call themselves.
 *
 * GitLab stores one `name` field and no notion of a given name, so the first
 * whitespace-separated word is the best available guess. It is a guess — where
 * the family name comes first, this greets by the family name — which is why the
 * greeting is warm rather than formal, and why the full name is never truncated
 * anywhere else.
 *
 * Null when there is nothing to greet: no viewer, or a name that is blank or
 * only whitespace. A greeting with a hole in it is worse than no greeting.
 */
export function greetingNameOf(viewer: null | Viewer): null | string {
  const first = viewer?.name.trim().split(/\s+/u, 1)[0]

  return first === undefined || first === '' ? null : first
}
