// zod 4's documented import form. The named `z` binding does not survive Vite's
// interop for this package, so the namespace import is also the one that works.
import * as z from 'zod'

import type { TimelogEntry, WorkItemRef } from '../model/types'

/**
 * The shape GitLab returns, parsed at the boundary.
 *
 * Parsing here means a schema change on GitLab's side surfaces as one clear
 * error naming the field, instead of an `undefined` reaching a component and
 * rendering as a blank hour figure.
 */
const projectSchema = z.object({
  fullPath: z.string(),
  name: z.string(),
  webUrl: z.string(),
})

const workItemSchema = z.object({
  reference: z.string(),
  title: z.string(),
  webUrl: z.string(),
})

const timelogSchema = z.object({
  issue: workItemSchema.nullable(),
  mergeRequest: workItemSchema.nullable(),
  project: projectSchema,
  spentAt: z.string(),
  /** GitLab sends an empty string, not null, when nothing was typed. */
  summary: z.string().nullable(),
  timeSpent: z.number(),
})

/**
 * The same entry as the recovery request asks for it: no project.
 *
 * GitLab withholds an entry entirely when it cannot resolve the project, so the
 * page has to be asked for again without that field. Two schemas rather than one
 * with an optional project: this way the first answer is still held to carrying
 * one, and a day when GitLab stops sending it fails loudly instead of quietly
 * attributing every entry to nothing.
 */
const recoveredTimelogSchema = timelogSchema.omit({ project: true })

const pageInfoSchema = z.object({
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
})

/**
 * A node is nullable.
 *
 * This is not defensiveness: GitLab's own `Timelog.project` is non-nullable
 * while the connection's items are not, so an entry whose project it will not
 * resolve arrives as `null`. Rejecting the page over one of those threw away the
 * other twenty-four entries in it.
 */
export const timelogsPayloadSchema = z.object({
  currentUser: z
    .object({
      timelogs: z.object({
        nodes: z.array(timelogSchema.nullable()),
        pageInfo: pageInfoSchema,
      }),
    })
    .nullable(),
})

export const recoveredTimelogsPayloadSchema = z.object({
  currentUser: z
    .object({
      timelogs: z.object({
        nodes: z.array(recoveredTimelogSchema.nullable()),
        pageInfo: pageInfoSchema,
      }),
    })
    .nullable(),
})

export type RecoveredTimelogsPayload = z.infer<typeof recoveredTimelogsPayloadSchema>

export type TimelogsPayload = z.infer<typeof timelogsPayloadSchema>

type RecoveredTimelog = z.infer<typeof recoveredTimelogSchema>

type Timelog = z.infer<typeof timelogSchema>

/**
 * A GitLab timelog as the model wants it.
 *
 * `spentAt` becomes an instant and stays one: which calendar day it belongs to
 * is the model's decision, made once, in the reader's time zone.
 */
export function toTimelogEntry(timelog: RecoveredTimelog | Timelog): TimelogEntry {
  return {
    // Absent rather than null: the recovery request never asked for it, so there
    // is no project to report and the entry counts without one.
    project: 'project' in timelog ? timelog.project : null,
    seconds: timelog.timeSpent,
    spentAt: new Date(timelog.spentAt),
    // An empty summary is no summary. Normalising here leaves the rest of the
    // app one absent case to handle instead of two.
    summary: timelog.summary === '' ? null : timelog.summary,
    workItem: toWorkItemRef(timelog),
  }
}

/**
 * A timelog carries either an issue or a merge request, never both, and may
 * carry neither.
 */
function toWorkItemRef(timelog: RecoveredTimelog | Timelog): null | WorkItemRef {
  if (timelog.issue) {
    return { kind: 'issue', ...timelog.issue }
  }

  return timelog.mergeRequest ? { kind: 'merge-request', ...timelog.mergeRequest } : null
}
