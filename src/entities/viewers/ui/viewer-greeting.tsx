import { useQuery } from '@tanstack/react-query'

import { m } from '@/shared/i18n'

import { viewerQuery } from '../api/queries'
import { greetingNameOf } from '../model/viewer'
import { useViewerGateway } from './gateway-provider'

/**
 * Greets whoever is signed in, by name.
 *
 * The line keeps its height whether or not there is a name yet. It sits above a
 * heading, so appearing later would push the whole screen down — and this app
 * asserts that loading does not move the page. An empty line above the date is
 * invisible; a page that jumps is not.
 *
 * Nothing is said when there is no name to say it with: a failed request, or an
 * account with a blank name, leaves the space quiet rather than greeting nobody.
 */
export function ViewerGreeting() {
  const { data } = useQuery(viewerQuery(useViewerGateway()))
  const name = greetingNameOf(data ?? null)

  return (
    <p className="h-5 text-sm text-muted-foreground">
      {name === null ? null : m.greeting({ name })}
    </p>
  )
}
