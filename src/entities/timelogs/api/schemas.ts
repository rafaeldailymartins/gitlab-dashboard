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

export const timelogsPayloadSchema = z.object({
  currentUser: z
    .object({
      timelogs: z.object({
        nodes: z.array(timelogSchema),
        pageInfo: z.object({
          endCursor: z.string().nullable(),
          hasNextPage: z.boolean(),
        }),
      }),
    })
    .nullable(),
})

export type TimelogsPayload = z.infer<typeof timelogsPayloadSchema>

type Timelog = z.infer<typeof timelogSchema>

/**
 * A GitLab timelog as the model wants it.
 *
 * `spentAt` becomes an instant and stays one: which calendar day it belongs to
 * is the model's decision, made once, in the reader's time zone.
 */
export function toTimelogEntry(timelog: Timelog): TimelogEntry {
  return {
    project: timelog.project,
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
function toWorkItemRef(timelog: Timelog): null | WorkItemRef {
  if (timelog.issue) {
    return { kind: 'issue', ...timelog.issue }
  }

  return timelog.mergeRequest ? { kind: 'merge-request', ...timelog.mergeRequest } : null
}
