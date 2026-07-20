import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { buildTimelogReport } from './build-report'

const inputSchema = z.object({
  days: z.number().int().min(1).max(366).default(7),
  username: z.string().min(1).optional(),
})

export const getTimelogReport = createServerFn({ method: 'GET' })
  .validator((input: unknown) => inputSchema.parse(input ?? {}))
  .handler(({ data }) => buildTimelogReport(data))
