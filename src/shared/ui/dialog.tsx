import type * as React from 'react'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'

import { m } from '@/shared/i18n'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

/*
 * Four deviations from what `shadcn add dialog` writes, all to be kept if this
 * component is ever regenerated.
 *
 * - `cn` comes from `@/shared/lib/utils`. The generator wrote `from "cn"` and
 *   installed an unrelated package of that name — the alias in
 *   `components.json` did not resolve — which would have put a dependency this
 *   app does not use on the audit surface.
 * - The backdrop is `bg-black/60`. A tenth of an alpha over this app's own dark
 *   surfaces is not a dimming, and the dialog it is meant to lift reads as a
 *   panel that happens to be in front.
 * - The close button is labelled from Paraglide. No user-facing string in this
 *   repository is a literal.
 * - No `sm:max-w-sm` default. This dialog is two panes wide, and a default the
 *   only caller always overrides is one that misleads the next.
 *
 * Regenerating this also overwrites `button.tsx`, which carries four measured
 * contrast fixes. Restore it.
 */

const CONTENT =
  'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'

const OVERLAY =
  'fixed inset-0 isolate z-50 bg-black/60 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0'

export const Dialog = DialogPrimitive.Root

export function DialogContent({
  children,
  className,
  ...props
}: Readonly<DialogPrimitive.Popup.Props>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className={OVERLAY} data-slot="dialog-overlay" />
      <DialogPrimitive.Popup
        className={cn(CONTENT, className)}
        data-slot="dialog-content"
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-3 right-3"
          data-slot="dialog-close"
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <XIcon aria-hidden />
          <span className="sr-only">{m.dialog_close()}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export function DialogDescription({
  className,
  ...props
}: Readonly<DialogPrimitive.Description.Props>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      data-slot="dialog-description"
      {...props}
    />
  )
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-1 border-b border-border px-5 py-4 pr-14', className)}
      data-slot="dialog-header"
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: Readonly<DialogPrimitive.Title.Props>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-base leading-snug font-semibold tracking-tight', className)}
      data-slot="dialog-title"
      {...props}
    />
  )
}
