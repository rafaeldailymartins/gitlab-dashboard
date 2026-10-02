import type { BrowserOptions, Event } from '@sentry/browser'

import {
  BrowserClient,
  dedupeIntegration,
  defaultStackParser,
  linkedErrorsIntegration,
  makeFetchTransport,
  Scope,
} from '@sentry/browser'

import { scrub } from '@/shared/lib/scrub'

import type { Reporter } from './fault-sink'

export interface ReporterConfig {
  readonly dsn: string
  readonly environment: string
  readonly release: string
}

/** Same origin, so the policy's `connect-src` stays this site and GitLab (OBS-4). */
const TUNNEL = '/.netlify/functions/monitor'

/**
 * A page that has sent this many has a loop, not a list of faults. The rest
 * would cost invocations on a plan that pauses the site when they run out, and
 * would tell the author nothing the first twenty did not.
 */
const MAX_REPORTS = 20

/**
 * The chunk that sends fault reports, fetched when the page is idle (OBS-5).
 *
 * A `BrowserClient` with two integrations, not `init()`. `init()` registers
 * every default integration — breadcrumbs, the HTTP client, sessions, the
 * global handlers — and costs half as much again; more to the point, each of
 * those is a way for something about the reader to get into a report, so they
 * are absent rather than switched off. The window's own error events reach this
 * through `monitoring.ts`, which was listening before this chunk existed.
 *
 * Every report is rebuilt by `scrub` (OBS-3). The client is also told to collect
 * nothing and to leave fetch errors' messages alone — Sentry 11 appends the host
 * to them by default, by rewriting the error the app itself holds.
 */
export function sentryReporter(
  config: ReporterConfig,
  transport: BrowserOptions['transport'] = makeFetchTransport,
): Reporter {
  const client = new BrowserClient({
    beforeSend: (event) => ({ ...scrub(located(event)), type: undefined }),
    dataCollection: NOTHING,
    dsn: config.dsn,
    enhanceFetchErrorMessages: false,
    environment: config.environment,
    integrations: [dedupeIntegration(), linkedErrorsIntegration()],
    ...(config.release === '' ? {} : { release: config.release }),
    sendClientReports: false,
    stackParser: defaultStackParser,
    transport,
    tunnel: TUNNEL,
  })
  let sent = 0

  client.init()

  return (error, tags) => {
    if (sent < MAX_REPORTS) {
      sent += 1
      client.captureException(error, undefined, new Scope().setTags(tags))
    }
  }
}

/** Every category the SDK could collect, collected not at all. */
const NOTHING = {
  cookies: false,
  frameContextLines: 0,
  graphQL: { document: false, variables: false },
  httpBodies: [],
  httpHeaders: false,
  stackFrameVariables: false,
  urlQueryParams: false,
  userInfo: false,
}

const BROWSERS: readonly (readonly [string, RegExp])[] = [
  ['Edge', /Edg\/([\d.]+)/u],
  ['Firefox', /Firefox\/([\d.]+)/u],
  ['Chrome', /Chrome\/([\d.]+)/u],
  // Last of the four, so a browser that also says `Version/` was matched above.
  ['Safari', /Version\/([\d.]+)/u],
]

const SYSTEMS: readonly (readonly [string, RegExp])[] = [
  ['Windows', /Windows/u],
  ['Android', /Android/u],
  ['iOS', /iPhone|iPad/u],
  ['macOS', /Mac OS X/u],
  ['Linux', /Linux/u],
]

/**
 * The screen's address, and which browser and system it was on.
 *
 * Added here because the integration that would add them — `httpContext` —
 * sends the user-agent as a request header, which OBS-3 forbids. A name and a
 * major version is what finding a browser-specific fault takes.
 */
function located(event: Event): Event {
  const agent = navigator.userAgent
  const browser = BROWSERS.find(([, pattern]) => pattern.test(agent))
  const system = SYSTEMS.find(([, pattern]) => pattern.test(agent))
  const version = browser?.[1].exec(agent)?.[1]?.split('.', 1)[0]

  return {
    ...event,
    contexts: {
      ...(browser === undefined ? {} : { browser: { name: browser[0], version } }),
      ...(system === undefined ? {} : { os: { name: system[0] } }),
    },
    request: { url: globalThis.location.href },
  }
}
