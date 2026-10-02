import type { BaseTransportOptions, TransportRequest } from '@sentry/core'

import { createTransport } from '@sentry/browser'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { sentryReporter } from './monitoring-sdk'

const CONFIG = {
  dsn: 'https://public@o1.ingest.de.sentry.io/42',
  environment: 'staging',
  release: 'a6fa2de',
}

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

/**
 * A transport that records where each report would have gone and what it said.
 *
 * The real one is not `fetch`: Sentry fetches a pristine copy of it from a
 * sandboxed frame, so a stubbed global never sees a request.
 */
function recordingTransport() {
  const sent: { body: string; url: string }[] = []
  const transport = (options: BaseTransportOptions) =>
    createTransport(options, (request: TransportRequest) => {
      sent.push({
        body:
          typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body),
        url: options.url,
      })

      return Promise.resolve({ statusCode: 200 })
    })

  return { sent, transport }
}

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.history.replaceState(null, '', '/')
})

describe('sentryReporter', () => {
  it('sends a fault through this origin, scrubbed and located (OBS-3, OBS-4)', async () => {
    const { sent, transport } = recordingTransport()

    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(CHROME)
    globalThis.history.replaceState(null, '', '/team?team=t1&group=acme%2Fsquad')
    sentryReporter(CONFIG, transport)(new Error('Team Squad Zeta not found'), { origin: 'query' })

    await vi.waitFor(() => {
      expect(sent).toHaveLength(1)
    })

    const [{ body, url } = { body: '', url: '' }] = sent

    expect(url).toMatch(/^\/\.netlify\/functions\/monitor/u)
    expect(body).not.toContain('Squad Zeta')
    expect(body).not.toContain('team=t1')
    expect(body).not.toContain('acme')
    expect(body).toContain('"release":"a6fa2de"')
    expect(body).toContain('"environment":"staging"')
    expect(body).toContain('"browser":{"name":"Chrome","version":"130"}')
    expect(body).toContain('"os":{"name":"Windows"}')
    expect(body).toContain('"origin":"query"')
  })

  it('stops after twenty reports from one page, which is a loop and not a list', async () => {
    const { sent, transport } = recordingTransport()
    const report = sentryReporter(CONFIG, transport)

    for (let index = 0; index < 25; index += 1) {
      report(new Error(`fault ${String(index)}`), { origin: 'global' })
    }

    await vi.waitFor(() => {
      expect(sent).toHaveLength(20)
    })
  })

  it('names no browser it does not recognise, rather than guessing', async () => {
    const { sent, transport } = recordingTransport()

    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('curl/8.0')
    sentryReporter({ ...CONFIG, release: '' }, transport)(new TypeError('x'), {})

    await vi.waitFor(() => {
      expect(sent).toHaveLength(1)
    })

    expect(sent[0]?.body).not.toContain('"browser"')
    expect(sent[0]?.body).not.toContain('"release"')
  })
})
