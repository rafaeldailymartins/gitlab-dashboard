import { m } from '@/shared/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'

import { TeamManager } from './team-manager'

interface TeamManagerDialogProps {
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
}

/**
 * The teams a reader keeps, over whatever they were reading.
 *
 * A dialog rather than a screen, which reverses the decision this surface
 * shipped with. That decision was sound about the wrong thing: the accessibility
 * and 375 px sweeps do address screens by URL, and `/settings` is a real
 * precedent for a place the app's own state is edited. But settings are edited
 * once, from anywhere, with nothing on screen depending on them, while a team is
 * edited *because of what the report in front of you shows* — and the report is
 * where you were going anyway. Sending the reader somewhere else to fix the list
 * their figures are about cost them their place and bought nothing: this surface
 * never had an address worth sending anybody, being one reader's private list.
 *
 * The trigger belongs to the caller. The report attaches it to the control that
 * names the team it acts on; settings puts it in a card. A trigger owned here
 * would be one button pretending to suit both.
 *
 * Nothing about which team is being edited lives in the address, for the same
 * reason there is no address at all.
 */
export function TeamManagerDialog({ onOpenChange, open }: TeamManagerDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{m.teams_heading()}</DialogTitle>
          <DialogDescription>{m.teams_description()}</DialogDescription>
        </DialogHeader>
        <TeamManager />
      </DialogContent>
    </Dialog>
  )
}
