import { describe, expect, it, vi } from 'vitest'

import type { DocumentStore } from './document-store.mjs'
import type { EndpointFault } from './endpoint-fault.mjs'
import type { Identity } from './identity.mjs'

import { memoryDocumentStore } from './document-store.mjs'
import { ANY_VERSION, handleDocument, VERSION_HEADER } from './handle-document.mjs'
import { MAX_BODY_BYTES, TEAMS_DOCUMENT } from './teams-document.mjs'

/**
 * Which answers the handler reports, and that reporting changes none of them
 * (OBS-2).
 *
 * A `503` is the endpoint failing, so it is reported with why. Every other
 * refusal is the endpoint working — a missing credential, a stale version, a
 * body too large or malformed — and reporting those would bury the faults under
 * every reader's expired session.
 */
const ADA = 'assertion-for-ada'
const ADDRESS = 'https://app.example/.netlify/functions/teams'

function verify(token: string): Promise<Identity> {
  return Promise.resolve(
    token === ADA ? { ok: true, sub: '1' } : { ok: false, reason: 'unauthenticated' },
  )
}

const BROKEN: DocumentStore = {
  read: () => Promise.reject(new Error('BlobsInternalError: v1/1/teams')),
  write: () => Promise.reject(new Error('BlobsInternalError: v1/1/teams')),
}

function put(body: string, headers: Record<string, string>): Request {
  return new Request(ADDRESS, {
    body,
    headers: { authorization: `Bearer ${ADA}`, 'content-type': 'application/json', ...headers },
    method: 'PUT',
  })
}

function recorder() {
  const faults: EndpointFault[] = []

  return { faults, report: (fault: EndpointFault) => faults.push(fault) }
}

const SIGNED = { headers: { authorization: `Bearer ${ADA}` } }
const VALID = JSON.stringify({ teams: [], version: 1 })

describe('the faults a document endpoint reports', () => {
  it('reports a store that cannot be read, with why, and still answers 503', async () => {
    const { faults, report } = recorder()

    const response = await handleDocument(new Request(ADDRESS, SIGNED), {
      document: TEAMS_DOCUMENT,
      report,
      store: BROKEN,
      verify,
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'store-unavailable' })
    expect(faults.map((fault) => fault.reason)).toEqual(['store-unavailable'])
    expect(faults[0]?.cause).toBeInstanceOf(Error)
  })

  it('reports a store that cannot be written', async () => {
    const { faults, report } = recorder()

    const response = await handleDocument(put(VALID, { [VERSION_HEADER]: ANY_VERSION }), {
      document: TEAMS_DOCUMENT,
      report,
      store: BROKEN,
      verify,
    })

    expect(response.status).toBe(503)
    expect(faults.map((fault) => fault.reason)).toEqual(['store-unavailable'])
  })

  it('reports a provider that could not say who is calling', async () => {
    const { faults, report } = recorder()

    const response = await handleDocument(new Request(ADDRESS, SIGNED), {
      document: TEAMS_DOCUMENT,
      report,
      store: memoryDocumentStore(),
      verify: () => Promise.resolve({ ok: false, reason: 'unavailable' }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'identity-unavailable' })
    expect(faults.map((fault) => fault.reason)).toEqual(['identity-unavailable'])
  })

  it.each([
    ['no credential', new Request(ADDRESS), 401],
    ['a method it does not answer', new Request(ADDRESS, { ...SIGNED, method: 'DELETE' }), 405],
    ['no version', put(VALID, {}), 428],
    [
      'the wrong type',
      put(VALID, { 'content-type': 'text/plain', [VERSION_HEADER]: ANY_VERSION }),
      415,
    ],
    [
      'a body too large',
      put('x'.repeat(MAX_BODY_BYTES + 1), { [VERSION_HEADER]: ANY_VERSION }),
      413,
    ],
    ['a malformed body', put('{"teams":', { [VERSION_HEADER]: ANY_VERSION }), 400],
  ])('reports nothing for a request with %s', async (_, request, status) => {
    const { faults, report } = recorder()

    const response = await handleDocument(request, {
      document: TEAMS_DOCUMENT,
      report,
      store: memoryDocumentStore(),
      verify,
    })

    expect(response.status).toBe(status)
    expect(faults).toEqual([])
  })

  it('reports nothing for a stale write, which is a conflict working', async () => {
    const { faults, report } = recorder()
    const store = memoryDocumentStore()
    const dependencies = { document: TEAMS_DOCUMENT, report, store, verify }

    await handleDocument(put(VALID, { [VERSION_HEADER]: ANY_VERSION }), dependencies)
    const stale = await handleDocument(put(VALID, { [VERSION_HEADER]: ANY_VERSION }), dependencies)

    expect(stale.status).toBe(409)
    expect(faults).toEqual([])
  })

  it('answers exactly as it would without a reporter', async () => {
    const reported = await handleDocument(new Request(ADDRESS, SIGNED), {
      document: TEAMS_DOCUMENT,
      report: vi.fn(),
      store: BROKEN,
      verify,
    })
    const unreported = await handleDocument(new Request(ADDRESS, SIGNED), {
      document: TEAMS_DOCUMENT,
      store: BROKEN,
      verify,
    })

    expect(reported.status).toBe(unreported.status)
    expect([...reported.headers]).toEqual([...unreported.headers])
    await expect(reported.text()).resolves.toBe(await unreported.text())
  })
})
