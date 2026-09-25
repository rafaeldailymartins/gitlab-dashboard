import { http, HttpResponse, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ANY_VERSION, VERSION_HEADER } from '@/shared/api'

import type { Identified, TeamsDocument } from '../model/ports'

import { TeamsError } from '../model/ports'
import { httpTeamsGateway } from './teams-gateway'

const ENDPOINT = '/.netlify/functions/teams'

const ADA = { id: 'gid://gitlab/User/1', name: 'Ada Lovelace', username: 'ada' }

const TEAM = {
  id: '0193f2c1-8a7e-7f3a-9c21-3b5d6e7f8a90',
  members: [ADA],
  name: 'Squad Fiscal',
  updatedAt: '2026-09-18T14:30:00.000Z',
}

const server = setupServer()

/** Captures what actually went out, so the preconditions are asserted. */
let lastRequest: null | Request = null

/** The caller, plus its spies held separately so a test can assert on them. */
function identified() {
  const identityToken = vi.fn(() => Promise.resolve('assertion-1'))
  const refresh = vi.fn(() => Promise.resolve('access-1'))
  const caller: Identified = { identityToken, refresh }

  return { caller, identityToken, refresh }
}

function respond(status: number, body: JsonBodyType, etag?: string) {
  return http.all(ENDPOINT, ({ request }) => {
    lastRequest = request.clone()

    return HttpResponse.json(body, {
      headers: etag === undefined ? {} : { etag },
      status,
    })
  })
}

/** One refusal, then whatever the second attempt should meet. */
function respondOnceThen(status: number, body: JsonBodyType) {
  let first = true

  return http.all(ENDPOINT, ({ request }) => {
    lastRequest = request.clone()

    if (first) {
      first = false

      return HttpResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    return HttpResponse.json(body, { headers: { etag: '"2"' }, status })
  })
}

const STORED = { teams: [TEAM], version: 1 }

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  lastRequest = null
})

afterAll(() => {
  server.close()
})

describe('read', () => {
  it('returns the teams and the version they were read at', async () => {
    server.use(respond(200, STORED, '"1"'))

    const document = await httpTeamsGateway(identified().caller).read()

    expect(document.etag).toBe('"1"')
    expect(document.teams).toHaveLength(1)
    expect(document.teams[0]?.name).toBe('Squad Fiscal')
  })

  it('carries the identity assertion and nothing else', async () => {
    server.use(respond(200, STORED, '"1"'))

    await httpTeamsGateway(identified().caller).read()

    expect(lastRequest?.headers.get('authorization')).toBe('Bearer assertion-1')
    // A token that reads GitLab is never sent here. The store is told who the
    // reader is, not handed the means to be them.
    expect(lastRequest?.headers.get('cookie')).toBeNull()
  })

  it('renews once and retries when the assertion arrived too late', async () => {
    server.use(respondOnceThen(200, STORED))
    const { caller, refresh } = identified()

    const document = await httpTeamsGateway(caller).read()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(document.teams).toHaveLength(1)
  })

  it('gives up after a second refusal rather than looping', async () => {
    server.use(respond(401, { error: 'unauthenticated' }))
    const { caller, refresh } = identified()

    await expect(httpTeamsGateway(caller).read()).rejects.toMatchObject({
      failure: { kind: 'identity-unavailable' },
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('reports a session that cannot prove who the reader is, not a store that is down', async () => {
    // What a grant made before this application asked for an identity does: it
    // renews happily and still has no assertion to hand over, for good. Escaping
    // as the session's own error, it was read as an unreachable store — and that
    // reader was told to wait for an outage that will never end.
    const caller: Identified = {
      identityToken: () => Promise.reject(new Error('no identity in this grant')),
      refresh: () => Promise.resolve('access-1'),
    }

    await expect(httpTeamsGateway(caller).read()).rejects.toMatchObject({
      failure: { kind: 'identity-unavailable' },
    })
  })

  it('reports a store that will not answer as worth retrying', async () => {
    server.use(respond(503, { error: 'store-unavailable' }))

    await expect(httpTeamsGateway(identified().caller).read()).rejects.toMatchObject({
      failure: { kind: 'unavailable' },
    })
  })

  it('reports a refusal of the request itself as not worth retrying', async () => {
    server.use(respond(400, { error: 'malformed' }))

    await expect(httpTeamsGateway(identified().caller).read()).rejects.toBeInstanceOf(TeamsError)
  })

  it('reports an unreachable store rather than leaking a network error', async () => {
    server.use(http.all(ENDPOINT, () => HttpResponse.error()))

    await expect(httpTeamsGateway(identified().caller).read()).rejects.toMatchObject({
      failure: { kind: 'unavailable' },
    })
  })

  it('lets an abort through, because it is the caller changing its mind', async () => {
    server.use(respond(200, STORED, '"1"'))
    const controller = new AbortController()
    controller.abort()

    await expect(httpTeamsGateway(identified().caller).read(controller.signal)).rejects.toThrow(
      /abort/iu,
    )
  })
})

describe('write', () => {
  const document: TeamsDocument = { etag: '"1"', teams: [TEAM] }

  it('names the version it is replacing', async () => {
    server.use(respond(200, STORED, '"2"'))

    const written = await httpTeamsGateway(identified().caller).write(document)

    expect(lastRequest?.headers.get(VERSION_HEADER)).toBe('"1"')
    expect(lastRequest?.headers.get('content-type')).toContain('application/json')
    expect(written.etag).toBe('"2"')
  })

  it('asserts that nothing is stored yet on a first write', async () => {
    server.use(respond(200, STORED, '"1"'))

    await httpTeamsGateway(identified().caller).write({ etag: null, teams: [TEAM] })

    // The endpoint refuses a write that names neither, because that is a caller
    // which never read — and accepting it is the silent clobber this prevents.
    expect(lastRequest?.headers.get(VERSION_HEADER)).toBe(ANY_VERSION)
    // Not the conditional headers this began as: Netlify's CDN consumes those
    // before a function sees them, so every write was refused 428 in production
    // while every gate stayed green.
    expect(lastRequest?.headers.get('if-none-match')).toBeNull()
    expect(lastRequest?.headers.get('if-match')).toBeNull()
  })

  it('sends the teams as the document the endpoint expects', async () => {
    server.use(respond(200, STORED, '"2"'))

    await httpTeamsGateway(identified().caller).write(document)

    await expect(lastRequest?.json()).resolves.toMatchObject({ version: 1 })
  })

  it('hands a conflict the current document, so it can be resolved', async () => {
    server.use(respond(409, { error: 'conflict', ...STORED }, '"9"'))

    await expect(httpTeamsGateway(identified().caller).write(document)).rejects.toMatchObject({
      failure: { current: { etag: '"9"' }, kind: 'conflict' },
    })
  })
})
