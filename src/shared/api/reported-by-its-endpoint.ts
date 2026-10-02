/**
 * Marks a query whose failures the endpoint behind it reports for itself.
 *
 * The reader's teams come from a document endpoint on this origin, and that
 * endpoint tells the tracker about every `503` it answers, with why (OBS-2). A
 * second report of the same fault from the browser would count it twice under
 * a less precise name — and the failure a reader's browser does see that the
 * endpoint does not, a session granted before `openid` was asked for, is the
 * reader's state rather than anybody's fault.
 *
 * It travels on the query, like `NOT_PERSISTED`, so the query client needs to
 * know nothing about which slice asked.
 */
export const REPORTED_BY_ITS_ENDPOINT = { reportFaults: false }
