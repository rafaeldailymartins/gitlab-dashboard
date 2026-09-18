import { beforeEach, describe, expect, it } from 'vitest'

import type { Identity } from './identity.mjs'
import type { TeamStore } from './team-store.mjs'

import { handleTeams } from './handle-teams.mjs'
import { memoryTeamStore } from './team-store.mjs'
import { MAX_BODY_BYTES } from './teams-document.mjs'

const ADA = 'assertion-for-ada'
const BRUNO = 'assertion-for-bruno'

/** A verifier that vouches for two people and nobody else. */
function verify(token: string): Promise<Identity> {
  if (token === ADA) {
    return Promise.resolve({ ok: true, sub: '1' })
  }

  return Promise.resolve(
    token === BRUNO ? { ok: true, sub: '2' } : { ok: false, reason: 'unauthenticated' },
  )
}

let store: TeamStore

beforeEach(() => {
  store = memoryTeamStore()
})

function document(name = 'Squad Fiscal') {
  return {
    teams: [
      {
        id: '0193f2c1-8a7e-7f3a-9c21-3b5d6e7f8a90',
        members: [{ id: 'gid://gitlab/User/9', name: 'Ada Lovelace', username: 'ada' }],
        name,
        updatedAt: '2026-09-18T14:30:00.000Z',
      },
    ],
    version: 1,
  }
}

function get(token?: string): Promise<Response> {
  const headers = token === undefined ? {} : { authorization: `Bearer ${token}` }

  return handleTeams(new Request('https://app.example/.netlify/functions/teams', { headers }), {
    store,
    verify,
  })
}

function put(token: string, body: unknown, preconditions: Record<string, string>) {
  const request = new Request('https://app.example/.netlify/functions/teams', {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...preconditions,
    },
    method: 'PUT',
  })

  return handleTeams(request, { store, verify })
}

/** The first write a reader ever makes: nothing is stored to match against. */
const FIRST = { 'if-none-match': '*' }

describe('the credential', () => {
  it('refuses a request carrying none', async () => {
    const response = await get()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthenticated' })
  })

  it('refuses one the provider will not vouch for, identically', async () => {
    const anonymous = await get()
    const forged = await get('not-a-real-assertion')

    // Answering these differently would tell somebody probing which of the two
    // they had managed.
    expect(forged.status).toBe(anonymous.status)
    await expect(forged.json()).resolves.toEqual(await anonymous.json())
  })

  it.each(['Basic abc', 'Bearer', 'Bearer ', ADA.replace('assertion', 'Bearer')])(
    'refuses the malformed header %s',
    async (header) => {
      const request = new Request('https://app.example/.netlify/functions/teams', {
        headers: { authorization: header },
      })

      const response = await handleTeams(request, { store, verify })

      expect(response.status).toBe(401)
    },
  )

  it('does not reach the store before it has one', async () => {
    let touched = false
    const watched: TeamStore = {
      read: (key) => {
        touched = true

        return store.read(key)
      },
      write: (key, text, expected) => {
        touched = true

        return store.write(key, text, expected)
      },
    }

    await handleTeams(new Request('https://app.example/.netlify/functions/teams'), {
      store: watched,
      verify,
    })

    // The free tier is a hard cap that pauses every site on the account, and
    // there is no rate limiting in front of this. Ordering is the control.
    expect(touched).toBe(false)
  })

  it('refuses a method it does not answer', async () => {
    const request = new Request('https://app.example/.netlify/functions/teams', {
      headers: { authorization: `Bearer ${ADA}` },
      method: 'DELETE',
    })

    const response = await handleTeams(request, { store, verify })

    expect(response.status).toBe(405)
  })
})

describe('reading', () => {
  it('gives a reader who has stored nothing an empty document', async () => {
    const response = await get(ADA)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ teams: [], version: 1 })
  })

  it('gives a reader back what they stored, with its version', async () => {
    const written = await put(ADA, document(), FIRST)

    const response = await get(ADA)

    expect(response.headers.get('etag')).toBe(written.headers.get('etag'))
    await expect(response.json()).resolves.toEqual(document())
  })

  it('never lets one reader see another', async () => {
    await put(ADA, document('Ada only'), FIRST)

    // The key is built from the verified subject and nothing in the request
    // reaches it, so there is no way to ask this question but by being Ada.
    const response = await get(BRUNO)

    await expect(response.json()).resolves.toEqual({ teams: [], version: 1 })
  })

  it('tells the reader nothing is kept on their behalf', async () => {
    const response = await get(ADA)

    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

describe('writing', () => {
  it('stores a document and hands back its new version', async () => {
    const response = await put(ADA, document(), FIRST)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).not.toBeNull()
  })

  it('refuses a write that named no version it was made against', async () => {
    const response = await put(ADA, document(), {})

    // A write with no precondition is a caller that never read.
    expect(response.status).toBe(428)
  })

  it('refuses a write against a version that is no longer current', async () => {
    const first = await put(ADA, document('first'), FIRST)
    await put(ADA, document('second'), { 'if-match': first.headers.get('etag') ?? '' })

    const stale = await put(ADA, document('third'), {
      'if-match': first.headers.get('etag') ?? '',
    })

    expect(stale.status).toBe(409)
    await expect(stale.json()).resolves.toMatchObject({ error: 'conflict' })
  })

  it('hands a conflict the current document, so it can be resolved', async () => {
    const first = await put(ADA, document('first'), FIRST)
    await put(ADA, document('second'), { 'if-match': first.headers.get('etag') ?? '' })

    const stale = await put(ADA, document('third'), {
      'if-match': first.headers.get('etag') ?? '',
    })

    await expect(stale.json()).resolves.toMatchObject({ teams: [{ name: 'second' }] })
  })

  it('refuses a second first-write, because something is stored now', async () => {
    await put(ADA, document(), FIRST)

    const again = await put(ADA, document(), FIRST)

    expect(again.status).toBe(409)
  })

  it.each([
    ['a body that is not JSON', 'not json at all'],
    ['a version it does not know', { teams: [], version: 2 }],
    ['a team with no name', { teams: [{ ...document().teams[0], name: '' }], version: 1 }],
  ])('refuses %s without echoing it', async (_label, body) => {
    const response = await put(ADA, body, FIRST)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'malformed' })
  })

  it('refuses a body larger than it will read', async () => {
    const huge = {
      teams: [{ ...document().teams[0], name: 'a'.repeat(MAX_BODY_BYTES) }],
      version: 1,
    }

    const response = await put(ADA, huge, FIRST)

    expect(response.status).toBe(413)
  })

  it('refuses a body that does not say it is JSON', async () => {
    const request = new Request('https://app.example/.netlify/functions/teams', {
      body: JSON.stringify(document()),
      headers: { authorization: `Bearer ${ADA}`, 'content-type': 'text/plain', ...FIRST },
      method: 'PUT',
    })

    const response = await handleTeams(request, { store, verify })

    expect(response.status).toBe(415)
  })

  it('cannot be aimed at another reader by anything in the request', async () => {
    await put(BRUNO, document('Bruno only'), FIRST)

    // Nothing in a body or an address can name a key: it is built from the
    // subject the signature established, and only from that.
    await put(ADA, { ...document('Ada only'), sub: '2', teams: document('Ada only').teams }, FIRST)

    const response = await get(BRUNO)

    await expect(response.json()).resolves.toMatchObject({
      teams: [{ name: 'Bruno only' }],
    })
  })
})

describe('when the store will not answer', () => {
  const broken: TeamStore = {
    read: () => Promise.reject(new Error('blobs are down')),
    write: () => Promise.reject(new Error('blobs are down')),
  }

  it('says so on a read, rather than claiming the reader has no teams', async () => {
    const response = await handleTeams(
      new Request('https://app.example/.netlify/functions/teams', {
        headers: { authorization: `Bearer ${ADA}` },
      }),
      { store: broken, verify },
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'store-unavailable' })
  })

  it('says so on a write, rather than reporting a save that did not happen', async () => {
    const request = new Request('https://app.example/.netlify/functions/teams', {
      body: JSON.stringify(document()),
      headers: { authorization: `Bearer ${ADA}`, 'content-type': 'application/json', ...FIRST },
      method: 'PUT',
    })

    const response = await handleTeams(request, { store: broken, verify })

    expect(response.status).toBe(503)
  })
})
