import { http, HttpResponse, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ANY_VERSION, VERSION_HEADER } from '@/shared/api'

import type { Identified } from '../model/ports'
import type { StoredPreferences } from '../model/preferences'

import { DEFAULT_PREFERENCES, withTimeZone } from '../model/preferences'
import { httpPreferencesGateway } from './preferences-gateway'

const ENDPOINT = '/.netlify/functions/preferences'

const EARLIER = '2026-09-22T10:00:00.000Z'
const LATER = '2026-09-23T10:00:00.000Z'

const server = setupServer()

/** Every request that went out, so the preconditions and the order are assertable. */
let sent: Request[] = []

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  sent = []
})

afterAll(() => {
  server.close()
})

/** The caller, with its refresh held apart so a test can assert on it. */
function caller() {
  const refresh = vi.fn(() => Promise.resolve('access-1'))
  const identified: Identified = {
    identityToken: vi.fn(() => Promise.resolve('assertion-1')),
    refresh,
  }

  return { identified, refresh }
}

/** The document as the endpoint answers it: the settings, flat, with a version. */
function onTheWire(updatedAt: string, timeZone = 'Europe/Lisbon') {
  return { ...withTimeZone(DEFAULT_PREFERENCES, timeZone), updatedAt, version: 1 }
}

/** Answers every request the same way. */
function respond(status: number, body: JsonBodyType, etag?: string) {
  return http.all(ENDPOINT, ({ request }) => {
    sent.push(request.clone())

    return HttpResponse.json(body, { headers: etag === undefined ? {} : { etag }, status })
  })
}

/** Answers each request from the queue, so a retry meets something different. */
function respondInTurn(
  ...answers: readonly { body: JsonBodyType; etag?: string; status: number }[]
) {
  let turn = 0

  return http.all(ENDPOINT, ({ request }) => {
    sent.push(request.clone())

    const answer = answers[Math.min(turn, answers.length - 1)]

    turn += 1

    return HttpResponse.json(answer?.body ?? null, {
      headers: answer?.etag === undefined ? {} : { etag: answer.etag },
      status: answer?.status ?? 200,
    })
  })
}

function settings(updatedAt: string, timeZone = 'Europe/Lisbon'): StoredPreferences {
  return { preferences: withTimeZone(DEFAULT_PREFERENCES, timeZone), updatedAt }
}

describe('reading', () => {
  it('answers with the stored settings and the version they were read at', async () => {
    server.use(respond(200, onTheWire(LATER), '"7"'))

    await expect(httpPreferencesGateway(caller().identified).read()).resolves.toEqual({
      etag: '"7"',
      settings: settings(LATER),
    })
  })

  // Not defaults: the device already holds those, and it has to tell "the store
  // has never heard of me" from "the store holds something older than mine".
  it('answers with nothing for a reader the store has never heard of', async () => {
    server.use(respond(200, null))

    await expect(httpPreferencesGateway(caller().identified).read()).resolves.toEqual({
      etag: null,
      settings: null,
    })
  })

  /*
   * A 200 carrying something that is not a document is a store that answered,
   * so it is not a refusal — and it is not settings either. Reading it as an
   * empty store is what makes the device send its own rather than adopt a shape
   * nobody wrote: the two ways that can arrive, a body that is not JSON and one
   * that is JSON of the wrong shape, both land here.
   */
  it('reads a body that is not a document as an empty store', async () => {
    server.use(http.all(ENDPOINT, () => new HttpResponse('not a document', { status: 200 })))

    await expect(httpPreferencesGateway(caller().identified).read()).resolves.toEqual({
      etag: null,
      settings: null,
    })
  })

  it('reads a document missing the fields that make it one as an empty store', async () => {
    server.use(respond(200, { nothing: 'to reconcile by' }))

    await expect(httpPreferencesGateway(caller().identified).read()).resolves.toEqual({
      etag: null,
      settings: null,
    })
  })

  /*
   * It used to answer with nothing, on the argument that every shape of nothing
   * deserved one rule. That made a refusal indistinguishable from a reader the
   * store has never heard of — so the caller recorded it as a success, said the
   * settings were synced, and never sent the change again.
   */
  it('rejects when the store refuses, rather than answering with nothing', async () => {
    server.use(respond(503, { error: 'store-unavailable' }))

    await expect(httpPreferencesGateway(caller().identified).read()).rejects.toThrow(/503/)
  })

  it('rejects a write the store refused, so the reader is told', async () => {
    server.use(respond(503, { error: 'store-unavailable' }))

    await expect(
      httpPreferencesGateway(caller().identified).write({
        etag: '"1"',
        settings: settings(LATER),
      }),
    ).rejects.toThrow(/503/)
  })

  it('mints a fresh assertion once when the held one had expired', async () => {
    server.use(
      respondInTurn(
        { body: { error: 'unauthenticated' }, status: 401 },
        { body: onTheWire(LATER), etag: '"1"', status: 200 },
      ),
    )

    const { identified, refresh } = caller()

    await expect(httpPreferencesGateway(identified).read()).resolves.toMatchObject({ etag: '"1"' })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(sent).toHaveLength(2)
  })
})

describe('writing', () => {
  it('asserts there is nothing stored on a first write', async () => {
    server.use(respond(200, onTheWire(LATER), '"1"'))

    await httpPreferencesGateway(caller().identified).write({
      etag: null,
      settings: settings(LATER),
    })

    expect(sent[0]?.headers.get(VERSION_HEADER)).toBe(ANY_VERSION)
    expect(sent[0]?.headers.get('if-none-match')).toBeNull()
  })

  it('names the version it is replacing on every write after that', async () => {
    server.use(respond(200, onTheWire(LATER), '"2"'))

    await httpPreferencesGateway(caller().identified).write({
      etag: '"1"',
      settings: settings(LATER),
    })

    expect(sent[0]?.headers.get(VERSION_HEADER)).toBe('"1"')
  })
})

/*
 * The half of this that is a policy rather than an endpoint. The store still
 * refuses a stale write and still refuses one naming no version; what these
 * prove is that nobody is ever asked to resolve the refusal.
 */
describe('a write that raced another device', () => {
  it('takes the other device’s settings when they were written later', async () => {
    server.use(respondInTurn({ body: onTheWire(LATER, 'Asia/Tokyo'), etag: '"9"', status: 409 }))

    const document = await httpPreferencesGateway(caller().identified).write({
      etag: '"1"',
      settings: settings(EARLIER),
    })

    expect(document).toEqual({ etag: '"9"', settings: settings(LATER, 'Asia/Tokyo') })
    // One write, then nothing: theirs is the answer, so there is nothing to send.
    expect(sent).toHaveLength(1)
  })

  it('writes once more, against their version, when ours was written later', async () => {
    server.use(
      respondInTurn(
        { body: onTheWire(EARLIER, 'Asia/Tokyo'), etag: '"9"', status: 409 },
        { body: onTheWire(LATER), etag: '"10"', status: 200 },
      ),
    )

    const document = await httpPreferencesGateway(caller().identified).write({
      etag: '"1"',
      settings: settings(LATER),
    })

    expect(document).toEqual({ etag: '"10"', settings: settings(LATER) })
    expect(sent).toHaveLength(2)
    // The second names what the first was told it was racing, not what it held.
    expect(sent[1]?.headers.get(VERSION_HEADER)).toBe('"9"')
  })

  /*
   * What stops this looping against a device that is writing steadily. A third
   * writer landing between the two attempts is by definition later than both, so
   * reading once and taking what is there is the same answer last-write-wins
   * would give — and it terminates.
   */
  it('stops at two writes and reads what is there', async () => {
    server.use(
      respondInTurn(
        { body: onTheWire(EARLIER), etag: '"9"', status: 409 },
        { body: onTheWire(EARLIER), etag: '"10"', status: 409 },
        { body: onTheWire(LATER, 'Asia/Tokyo'), etag: '"11"', status: 200 },
      ),
    )

    const document = await httpPreferencesGateway(caller().identified).write({
      etag: '"1"',
      settings: settings(LATER),
    })

    expect(document).toEqual({ etag: '"11"', settings: settings(LATER, 'Asia/Tokyo') })
    expect(sent).toHaveLength(3)
    expect(sent[2]?.method).toBe('GET')
  })
})
