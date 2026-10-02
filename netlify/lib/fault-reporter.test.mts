import { parseEnvelope } from '@sentry/core'
import { describe, expect, it, vi } from 'vitest'

import { EndpointFault } from './endpoint-fault.mjs'
import { faultReporter } from './fault-reporter.mjs'

const DSN = 'https://public@o1.ingest.de.sentry.io/42'

function recording() {
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))
}

function sentEvent(upstream: ReturnType<typeof recording>): Record<string, unknown> {
  const body = upstream.mock.calls[0]?.[1]?.body

  if (typeof body !== 'string') {
    throw new TypeError('Nothing was sent as text')
  }

  const [, items] = parseEnvelope(body)
  const event = items.find(([header]) => header.type === 'event')?.[1]

  return (event ?? {}) as Record<string, unknown>
}

describe("the functions' fault reporter", () => {
  it('sends nothing, anywhere, without a project', async () => {
    for (const dsn of [undefined, '', '  ']) {
      const upstream = recording()
      const reporter = faultReporter({ dsn, environment: 'production', fetch: upstream })

      reporter.capture(new Error('fault'), { reason: 'store-unavailable' })
      await reporter.flush(100)

      expect(upstream).not.toHaveBeenCalled()
    }
  })

  it('sends a fault to the project, tagged with where it came from', async () => {
    const upstream = recording()
    const reporter = faultReporter({
      dsn: DSN,
      environment: 'staging',
      fetch: upstream,
      release: 'a6fa2de',
    })

    reporter.capture(new EndpointFault('store-unavailable'), {
      document: 'teams',
      origin: 'endpoint',
      reason: 'store-unavailable',
    })
    await reporter.flush(1000)

    expect(upstream.mock.calls[0]?.[0]).toMatch(
      /^https:\/\/o1\.ingest\.de\.sentry\.io\/api\/42\/envelope\//u,
    )

    const event = sentEvent(upstream)

    expect(event).toMatchObject({
      environment: 'staging',
      exception: { values: [{ type: 'EndpointFault', value: 'store-unavailable' }] },
      release: 'a6fa2de',
      tags: { document: 'teams', origin: 'endpoint', reason: 'store-unavailable' },
    })
  })

  it("sends a store's error by its class alone, since its message can name the reader's key", async () => {
    const upstream = recording()
    const reporter = faultReporter({ dsn: DSN, environment: 'production', fetch: upstream })
    const cause = new Error('BlobsInternalError: could not read v1/4242/teams')

    reporter.capture(new EndpointFault('store-unavailable', { cause }), {
      reason: 'store-unavailable',
    })
    await reporter.flush(1000)

    const sent = JSON.stringify(sentEvent(upstream))

    expect(sent).not.toContain('4242')
    expect(sent).toContain('EndpointFault')
  })

  it('never lets a tracker that cannot be reached throw into the endpoint', async () => {
    const down = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    const reporter = faultReporter({ dsn: DSN, environment: 'production', fetch: down })

    reporter.capture(new Error('fault'), {})

    await expect(reporter.flush(1000)).resolves.toBeTypeOf('boolean')
  })
})
