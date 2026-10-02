import type { Event } from '@sentry/core'

import { describe, expect, it } from 'vitest'

import { scrub } from './scrub'

const ASSET = 'https://gitlabdashboard.netlify.app/assets/index-CaqkUbAi.js'

function exceptionOf(type: string, value: string): Event {
  return {
    exception: {
      values: [
        {
          mechanism: { handled: false, type: 'onerror' },
          stacktrace: { frames: [{ colno: 7, filename: ASSET, function: 'render', lineno: 3 }] },
          type,
          value,
        },
      ],
    },
  }
}

function valueOf(event: Event): string | undefined {
  return event.exception?.values?.[0]?.value
}

describe('scrub', () => {
  it('keeps what locates a fault', () => {
    const event: Event = {
      ...exceptionOf('TypeError', "Cannot read properties of undefined (reading 'name')"),
      contexts: { browser: { name: 'Firefox', version: '131' }, os: { name: 'Linux' } },
      debug_meta: { images: [{ code_file: ASSET, debug_id: 'abc', type: 'sourcemap' }] },
      environment: 'production',
      event_id: 'e1',
      level: 'error',
      platform: 'javascript',
      release: 'a6fa2de',
      sdk: {
        name: 'sentry.javascript.browser',
        settings: { infer_ip: 'never' },
        version: '11.2.0',
      },
      tags: { kind: 'unavailable', origin: 'query' },
      timestamp: 1,
    }

    expect(scrub(event)).toEqual(event)
  })

  it('drops every field it was not told to keep', () => {
    const scrubbed = scrub({
      breadcrumbs: [{ message: 'fetch https://gitlab.com/api/graphql' }],
      extra: { team: 'Platform' },
      fingerprint: ['ada'],
      logentry: { message: 'ada' },
      message: 'ada',
      modules: { ada: '1' },
      server_name: 'ada-laptop',
      transaction: '/team',
      user: {
        email: 'ada@example.com',
        ip_address: 'the-address-ada-connected-from',
        username: 'ada',
      },
    })

    expect(scrubbed).toEqual({})
  })

  it('sends the address without its query string, its fragment or anything else about the request', () => {
    const scrubbed = scrub({
      request: {
        cookies: { session: 'x' },
        data: { query: 'query { currentUser { username } }' },
        headers: { authorization: 'Bearer glpat-x' },
        query_string: 'team=t1',
        url: 'https://gitlabdashboard.netlify.app/team?team=t1&group=acme/squad#top',
      },
    })

    expect(scrubbed.request).toEqual({ url: 'https://gitlabdashboard.netlify.app/team' })
  })

  it('cuts the query from a frame and from a debug image, and drops what a frame carries beyond its place', () => {
    const scrubbed = scrub({
      debug_meta: { images: [{ code_file: `${ASSET}?v=1`, debug_id: 'abc', type: 'sourcemap' }] },
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  abs_path: `${ASSET}?token=glpat-x`,
                  context_line: 'const user = "ada"',
                  filename: `${ASSET}#frag`,
                  module_metadata: { owner: 'ada' },
                  vars: { username: 'ada' },
                },
              ],
            },
            type: 'TypeError',
            value: 'x',
          },
        ],
      },
    })
    const frame = scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0]

    expect(frame).toEqual({ abs_path: ASSET, filename: ASSET })
    expect(scrubbed.debug_meta?.images?.[0]).toEqual({
      code_file: ASSET,
      debug_id: 'abc',
      type: 'sourcemap',
    })
  })

  it("keeps the message of the app's own errors and of the engine's", () => {
    for (const type of ['GraphQLRequestError', 'AuthError', 'TeamsError', 'RangeError']) {
      expect(valueOf(scrub(exceptionOf(type, 'GraphQL request failed: rejected')))).toBe(
        'GraphQL request failed: rejected',
      )
    }

    expect(valueOf(scrub(exceptionOf('ReferenceError', 'foo is not defined')))).toBe(
      'foo is not defined',
    )
  })

  it('replaces a message nobody here wrote with the name of its class', () => {
    // `JSON.parse` quotes its input in the message, which is a response body.
    expect(valueOf(scrub(exceptionOf('SyntaxError', '"ada" is not valid JSON')))).toBe(
      'SyntaxError',
    )
    expect(valueOf(scrub(exceptionOf('Error', 'Team Platform not found')))).toBe('Error')
    expect(valueOf(scrub(exceptionOf('UnhandledRejection', 'Non-Error value: ada')))).toBe(
      'UnhandledRejection',
    )
  })

  it('names an exception with no class as an error, never by what it said', () => {
    const scrubbed = scrub({ exception: { values: [{ value: 'ada' }] } })

    expect(scrubbed.exception?.values?.[0]).toEqual({ value: 'Error' })
  })

  it('cuts a kept message at two hundred characters', () => {
    expect(valueOf(scrub(exceptionOf('TypeError', 'x'.repeat(500))))).toHaveLength(200)
  })

  it('keeps the links between chained errors and nothing else the mechanism carries', () => {
    const scrubbed = scrub({
      exception: {
        values: [
          {
            mechanism: {
              data: { target: 'ada' },
              exception_id: 1,
              handled: true,
              is_exception_group: false,
              parent_id: 0,
              source: 'cause',
              synthetic: true,
              type: 'chained',
            },
            type: 'TypeError',
          },
        ],
      },
    })

    expect(scrubbed.exception?.values?.[0]?.mechanism).toEqual({
      exception_id: 1,
      handled: true,
      is_exception_group: false,
      parent_id: 0,
      source: 'cause',
      synthetic: true,
      type: 'chained',
    })
  })

  it('keeps only the tags it knows, and only when they are strings', () => {
    const scrubbed = scrub({
      tags: { document: 'teams', group: 'acme/squad', reason: 'store-unavailable', team: 1 },
    })

    expect(scrubbed.tags).toEqual({ document: 'teams', reason: 'store-unavailable' })
  })

  it('keeps the name and version of the browser and the system, and no other context', () => {
    const scrubbed = scrub({
      contexts: {
        browser: { name: 'Chrome', type: 'browser', version: '130', viewport: '1280' },
        culture: { timezone: 'America/Sao_Paulo' },
        os: { kernel_version: '6', name: 'Windows', version: '11' },
      },
    })

    expect(scrubbed.contexts).toEqual({
      browser: { name: 'Chrome', version: '130' },
      os: { name: 'Windows', version: '11' },
    })
  })

  it('keeps the name and version of the SDK, and tells the tracker not to infer an address', () => {
    const scrubbed = scrub({
      sdk: {
        integrations: ['ada'],
        name: 'sentry.javascript.browser',
        settings: { infer_ip: 'auto' },
        version: '11.2.0',
      },
    })

    expect(scrubbed.sdk).toEqual({
      name: 'sentry.javascript.browser',
      settings: { infer_ip: 'never' },
      version: '11.2.0',
    })
  })

  it("keeps a function's file path, which is not a web address", () => {
    const scrubbed = scrub({
      exception: {
        values: [
          {
            stacktrace: { frames: [{ filename: '/var/task/netlify/lib/handle-document.mjs?x' }] },
            type: 'TypeError',
          },
        ],
      },
    })

    expect(scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: '/var/task/netlify/lib/handle-document.mjs',
    })
  })

  it('leaves an address out rather than sending one it cannot read as a web address', () => {
    expect(scrub({ request: { url: 'not a url?team=t1' } })).toEqual({})
    expect(scrub({ request: { url: 'javascript:alert(document.cookie)' } })).toEqual({})
  })

  it('leaves out a debug image that is not a source map', () => {
    const scrubbed = scrub({
      debug_meta: { images: [{ code_file: 'app.wasm', debug_id: 'w', type: 'wasm' }] },
    })

    expect(scrubbed.debug_meta).toEqual({ images: [] })
  })

  it('keeps a name or a version only when it is text', () => {
    const scrubbed = scrub({ contexts: { browser: { name: 42, version: '130' } } })

    expect(scrubbed.contexts).toEqual({ browser: { version: '130' } })
  })

  it('leaves out every context it does not know', () => {
    expect(scrub({ contexts: { culture: { timezone: 'America/Sao_Paulo' } } })).toEqual({})
  })
})
