import { parseEnvelope } from '@sentry/core'
import { describe, expect, it, vi } from 'vitest'

import { envelopeTunnel } from './envelope-tunnel.mjs'

const DSN = 'https://public@o1.ingest.de.sentry.io/42'
const UPSTREAM = 'https://o1.ingest.de.sentry.io/api/42/envelope/'
const ADDRESS = 'https://gitlabdashboard.netlify.app/.netlify/functions/monitor'

const EVENT = {
  event_id: 'e1',
  exception: { values: [{ type: 'Error', value: 'Team Squad Zeta not found' }] },
  request: { url: 'https://gitlabdashboard.netlify.app/team?team=t1' },
  user: { username: 'ada' },
}

const HEADER = { dsn: DSN, event_id: 'e1', sent_at: '2026-10-01T00:00:00Z' }

function envelope(
  items: readonly (readonly [object, object | string])[],
  header: object = HEADER,
): string {
  const lines = [JSON.stringify(header)]

  for (const [itemHeader, payload] of items) {
    lines.push(
      JSON.stringify(itemHeader),
      typeof payload === 'string' ? payload : JSON.stringify(payload),
    )
  }

  return lines.join('\n')
}

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request(ADDRESS, { body, headers, method: 'POST' })
}

/** What the tunnel sent upstream, as the text it is. */
function sentBody(upstream: ReturnType<typeof vi.fn<typeof fetch>>): string {
  const body = upstream.mock.calls[0]?.[1]?.body

  if (typeof body !== 'string') {
    throw new TypeError('Nothing was forwarded as text')
  }

  return body
}

async function statusOf(answer: Promise<Response>): Promise<number> {
  const response = await answer

  return response.status
}

function tunnel(dsn: string | undefined) {
  const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))

  return { forward: envelopeTunnel({ dsn, fetch: upstream }), upstream }
}

describe('the reporting tunnel', () => {
  it('forwards an error report to the configured project, scrubbed', async () => {
    const { forward, upstream } = tunnel(DSN)

    const response = await forward(post(envelope([[{ type: 'event' }, EVENT]])))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')

    const [url, init] = upstream.mock.calls[0] ?? []
    const [, items] = parseEnvelope(sentBody(upstream))
    const sent = JSON.stringify(items)

    expect(url).toBe(UPSTREAM)
    expect(new Headers(init?.headers).get('content-type')).toBe('application/x-sentry-envelope')
    expect(sent).not.toContain('ada')
    expect(sent).not.toContain('Squad Zeta')
    expect(sent).not.toContain('team=t1')
  })

  it('passes no header of the incoming request on, so the tracker sees neither the reader nor their credential', async () => {
    const { forward, upstream } = tunnel(DSN)

    await forward(
      post(envelope([[{ type: 'event' }, EVENT]]), {
        authorization: 'Bearer glpat-secret',
        cookie: 'session=1',
        'x-forwarded-for': '203.0.113.7',
      }),
    )

    const headers = new Headers(upstream.mock.calls[0]?.[1]?.headers)

    expect([...headers.keys()]).toEqual(['content-type'])
  })

  it('keeps only what locates the envelope in its header', async () => {
    const { forward, upstream } = tunnel(DSN)
    const header = {
      dsn: DSN,
      event_id: 'e1',
      sdk: { integrations: ['x'], name: 'sentry.javascript.browser', version: '11.2.0' },
      sent_at: '2026-10-01T00:00:00Z',
      trace: { public_key: 'public', transaction: '/team?team=t1', user_segment: 'ada' },
    }

    await forward(post(envelope([[{ type: 'event' }, EVENT]], header)))

    const [sentHeader] = parseEnvelope(sentBody(upstream))

    expect(sentHeader).toEqual({
      dsn: DSN,
      event_id: 'e1',
      sdk: { name: 'sentry.javascript.browser', version: '11.2.0' },
      sent_at: '2026-10-01T00:00:00Z',
    })
  })

  it('refuses a report for another project, and forwards nothing (OBS-4)', async () => {
    const { forward, upstream } = tunnel(DSN)

    for (const dsn of [
      'https://public@o1.ingest.de.sentry.io/43',
      'https://public@o2.ingest.de.sentry.io/42',
      'https://public@attacker.example/42',
    ]) {
      const response = await forward(post(envelope([[{ type: 'event' }, EVENT]], { dsn })))

      expect(response.status).toBe(400)
    }

    expect(upstream).not.toHaveBeenCalled()
  })

  it('refuses something that is not an envelope', async () => {
    const { forward, upstream } = tunnel(DSN)

    for (const body of ['', 'not json', '{"event_id":"e1"}', '[1,2]']) {
      expect(await statusOf(forward(post(body)))).toBe(400)
    }

    expect(upstream).not.toHaveBeenCalled()
  })

  it('drops everything that is not an error event, and forwards nothing when that is all there was', async () => {
    const { forward, upstream } = tunnel(DSN)
    const body = envelope([
      [{ type: 'session' }, { sid: 's', status: 'ok' }],
      [{ type: 'replay_event' }, { urls: ['https://gitlabdashboard.netlify.app/team?team=t1'] }],
      [{ type: 'client_report' }, { discarded_events: [] }],
    ])

    const response = await forward(post(body))

    expect(response.status).toBe(204)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('forwards the error events out of a mixed envelope and nothing else', async () => {
    const { forward, upstream } = tunnel(DSN)
    const body = envelope([
      [{ type: 'session' }, { sid: 's' }],
      [{ type: 'event' }, EVENT],
    ])

    await forward(post(body))

    const [, items] = parseEnvelope(sentBody(upstream))

    expect(items.map(([itemHeader]) => itemHeader.type)).toEqual(['event'])
  })

  it('refuses a body larger than a report could be, whether it says so or not', async () => {
    const { forward, upstream } = tunnel(DSN)
    const large = envelope([
      [{ type: 'event' }, { ...EVENT, extra: { blob: 'x'.repeat(120_000) } }],
    ])

    expect(await statusOf(forward(post(large)))).toBe(413)
    expect(await statusOf(forward(post('{}', { 'content-length': '200000' })))).toBe(413)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('forwards to a self-hosted tracker on its own port, which is what leaving Sentry looks like', async () => {
    const selfHosted = 'https://public@bugsink.example:8443/7'
    const { forward, upstream } = tunnel(selfHosted)

    await forward(post(envelope([[{ type: 'event' }, EVENT]], { dsn: selfHosted })))

    expect(upstream.mock.calls[0]?.[0]).toBe('https://bugsink.example:8443/api/7/envelope/')
  })

  it('takes reports and nothing else', async () => {
    const { forward } = tunnel(DSN)

    expect(await statusOf(forward(new Request(ADDRESS)))).toBe(405)
  })

  it('reports nothing anywhere when no project is configured', async () => {
    for (const dsn of [undefined, '', 'not a dsn']) {
      const { forward, upstream } = tunnel(dsn)

      expect(await statusOf(forward(post(envelope([[{ type: 'event' }, EVENT]]))))).toBe(404)
      expect(upstream).not.toHaveBeenCalled()
    }
  })

  it('answers with what the tracker answered, and does not report a tracker that failed (OBS-6)', async () => {
    const refused = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }))
    const down = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    const body = envelope([[{ type: 'event' }, EVENT]])

    expect(await statusOf(envelopeTunnel({ dsn: DSN, fetch: refused })(post(body)))).toBe(429)
    expect(await statusOf(envelopeTunnel({ dsn: DSN, fetch: down })(post(body)))).toBe(502)
  })
})
