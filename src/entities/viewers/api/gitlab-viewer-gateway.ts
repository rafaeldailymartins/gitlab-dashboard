// zod 4's documented import form. The named `z` binding does not survive Vite's
// interop for this package, so the namespace import is also the one that works.
import * as z from 'zod'

import type { GraphQLClient } from '@/shared/api'

import type { ViewerGateway } from '../model/ports'

/**
 * One field. GitLab has no notion of a given name, so `name` is the whole of
 * what it can tell us about what to call someone.
 */
const ME = `
  query Me {
    currentUser {
      name
    }
  }
`

const payloadSchema = z.object({
  currentUser: z.object({ name: z.string() }).nullable(),
})

/** Reads the signed-in person's name from GitLab. */
export function gitLabViewerGateway(client: GraphQLClient): ViewerGateway {
  return {
    async me(signal) {
      // No variables: the query asks about whoever the credential belongs to,
      // which is not something the caller gets to name. The signal is spread
      // rather than passed because `exactOptionalPropertyTypes` distinguishes an
      // absent property from one that is `undefined`.
      const { data } = await client.request({
        query: ME,
        variables: {},
        ...(signal ? { signal } : {}),
      })

      return payloadSchema.parse(data).currentUser
    },
  }
}
