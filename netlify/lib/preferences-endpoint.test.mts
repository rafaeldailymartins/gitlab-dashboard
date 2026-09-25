import { beforeEach, describe, expect, it } from 'vitest'

import type { DocumentStore } from './document-store.mjs'
import type { DocumentKind } from './handle-document.mjs'
import type { Identity } from './identity.mjs'

import { memoryDocumentStore } from './document-store.mjs'
import { ANY_VERSION, handleDocument, VERSION_HEADER } from './handle-document.mjs'
import { PREFERENCES_DOCUMENT } from './preferences-document.mjs'
import { TEAMS_DOCUMENT } from './teams-document.mjs'

const ADA = 'assertion-for-ada'
const BRUNO = 'assertion-for-bruno'

/** The first write a reader ever makes: nothing is stored to match against. */
const FIRST = { [VERSION_HEADER]: ANY_VERSION }

/** A verifier that vouches for two people and nobody else. */
function verify(token: string): Promise<Identity> {
  if (token === ADA) {
    return Promise.resolve({ ok: true, sub: '1' })
  }

  return Promise.resolve(
    token === BRUNO ? { ok: true, sub: '2' } : { ok: false, reason: 'unauthenticated' },
  )
}

let store: DocumentStore

beforeEach(() => {
  store = memoryDocumentStore()
})

/** The body a request answered with, as JSON. */
async function bodyOf(response: Promise<Response>): Promise<unknown> {
  const answered = await response

  return answered.json()
}

function get(token: string, kind: DocumentKind = PREFERENCES_DOCUMENT): Promise<Response> {
  const request = new Request('https://app.example/.netlify/functions/preferences', {
    headers: { authorization: `Bearer ${token}` },
  })

  return handleDocument(request, { document: kind, store, verify })
}

function put(
  token: string,
  body: unknown,
  kind: DocumentKind = PREFERENCES_DOCUMENT,
): Promise<Response> {
  const request = new Request('https://app.example/.netlify/functions/preferences', {
    body: JSON.stringify(body),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...FIRST },
    method: 'PUT',
  })

  return handleDocument(request, { document: kind, store, verify })
}

function settings(timeZone = 'Europe/Lisbon') {
  return {
    dailyTarget: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 7: 0 },
    timeZone,
    updatedAt: '2026-09-23T10:00:00.000Z',
    version: 1,
  }
}

function teams() {
  return {
    teams: [
      {
        id: '0193f2c1-8a7e-7f3a-9c21-3b5d6e7f8a90',
        members: [],
        name: 'Squad Fiscal',
        updatedAt: '2026-09-18T14:30:00.000Z',
      },
    ],
    version: 1,
  }
}

describe('the settings endpoint', () => {
  it('answers a reader who has stored nothing with nothing, rather than with defaults', async () => {
    const response = await get(ADA)

    expect(response.status).toBe(200)
    // Null rather than a document full of defaults: the device already holds
    // defaults, and it needs to tell "the store has never heard of me" from
    // "the store holds something older than mine".
    await expect(response.json()).resolves.toBeNull()
  })

  it('keeps what a reader stored, and hands it back', async () => {
    await put(ADA, settings())

    await expect(bodyOf(get(ADA))).resolves.toEqual(settings())
  })

  it('refuses a credential it cannot verify, without touching the store', async () => {
    const reads: string[] = []
    const watched: DocumentStore = {
      read: (key) => {
        reads.push(key)

        return store.read(key)
      },
      write: (key, text, expected) => store.write(key, text, expected),
    }

    const response = await handleDocument(
      new Request('https://app.example/.netlify/functions/preferences'),
      { document: PREFERENCES_DOCUMENT, store: watched, verify },
    )

    expect(response.status).toBe(401)
    expect(reads).toEqual([])
  })

  /*
   * The property the whole endpoint rests on, asserted for the second document
   * as well as the first: the key comes from the verified subject and from
   * nothing the request carried, so one reader's settings are not addressable
   * from another's request at all.
   */
  it('never lets one reader reach another’s settings', async () => {
    await put(ADA, settings('Europe/Lisbon'))
    await put(BRUNO, settings('Asia/Tokyo'))

    await expect(bodyOf(get(ADA))).resolves.toMatchObject({ timeZone: 'Europe/Lisbon' })
    await expect(bodyOf(get(BRUNO))).resolves.toMatchObject({ timeZone: 'Asia/Tokyo' })
  })

  /*
   * The one failure the suffix introduced, and the reason both endpoints share a
   * store in development too: a suffix that was not distinct would have the two
   * documents overwriting each other under one reader, and each would look
   * perfectly well-formed on its own.
   */
  it('keeps one reader’s settings and teams apart under the same subject', async () => {
    await put(ADA, teams(), TEAMS_DOCUMENT)
    await put(ADA, settings(), PREFERENCES_DOCUMENT)

    await expect(bodyOf(get(ADA, TEAMS_DOCUMENT))).resolves.toEqual(teams())
    await expect(bodyOf(get(ADA, PREFERENCES_DOCUMENT))).resolves.toEqual(settings())
  })

  it('refuses a target no day could hold', async () => {
    const response = await put(ADA, {
      ...settings(),
      dailyTarget: { 1: 25, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 7: 0 },
    })

    expect(response.status).toBe(400)
  })

  it('refuses a zone no runtime recognises', async () => {
    const response = await put(ADA, settings('Mars/Olympus'))

    expect(response.status).toBe(400)
  })

  /*
   * The document's own `parse` is handed whatever arrived, so the throw inside
   * `JSON.parse` is a branch of the endpoint rather than a formality: a body
   * that is not JSON at all has to be refused exactly as one of the wrong shape
   * is, and not escape as a 500 naming an internal parser.
   */
  it('refuses a body that is not a document at all', async () => {
    const request = new Request('https://app.example/.netlify/functions/preferences', {
      body: 'not a document',
      headers: { authorization: `Bearer ${ADA}`, 'content-type': 'application/json', ...FIRST },
      method: 'PUT',
    })

    const response = await handleDocument(request, {
      document: PREFERENCES_DOCUMENT,
      store,
      verify,
    })

    expect(response.status).toBe(400)
  })

  it('refuses a document with no instant to reconcile by', async () => {
    const { updatedAt, ...withoutInstant } = settings()

    expect(updatedAt).not.toBe('')
    const response = await put(ADA, withoutInstant)

    expect(response.status).toBe(400)
  })

  it('refuses a write that names no version it is replacing', async () => {
    const request = new Request('https://app.example/.netlify/functions/preferences', {
      body: JSON.stringify(settings()),
      headers: { authorization: `Bearer ${ADA}`, 'content-type': 'application/json' },
      method: 'PUT',
    })

    const response = await handleDocument(request, {
      document: PREFERENCES_DOCUMENT,
      store,
      verify,
    })

    expect(response.status).toBe(428)
  })
})
