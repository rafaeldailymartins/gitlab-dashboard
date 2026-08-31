import { m } from '@/shared/i18n'

import type { ProjectRef } from '../model/types'

/**
 * What to write where a project's name belongs.
 *
 * An entry GitLab would not resolve a project for is counted with none, and
 * every screen that shows a project has to say so rather than leave the place
 * blank: a blank reads as a rendering fault, and a reader cannot tell it from
 * one. The wording lives in the catalogues, so `model/` stays free of strings.
 */
export function projectName(project: null | ProjectRef): string {
  return project?.name ?? m.report_no_project()
}

/** The same, where a screen shows the group path rather than the name. */
export function projectPath(project: null | ProjectRef): string {
  return project?.fullPath ?? m.report_no_project()
}
