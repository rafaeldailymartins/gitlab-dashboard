import { Select as SelectPrimitive } from '@base-ui/react/select'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { POPUP_ITEM, POPUP_LIST, POPUP_SURFACE, POPUP_TRIGGER } from '@/shared/ui/popup'

/*
 * Six deviations from what `shadcn add select` writes, all to be kept if this
 * component is ever regenerated.
 *
 * - `cn` comes from `@/shared/lib/utils`. The generator wrote `from "cn"` and
 *   installed an unrelated package of that name — twice now, once for the dialog
 *   and once for this. See `AGENTS.md`.
 * - The surface, the rows, the list and the closed control come from `popup.ts`
 *   rather than being written out here. They are the same declarations the
 *   combobox uses, and the two stand side by side in the report's toolbar.
 * - `alignItemWithTrigger` defaults to **false**. Base UI's default lays the
 *   popup over the trigger with the chosen row on top of it, which is what a
 *   native macOS select does and is not what the combobox beside it does. The
 *   panel drops below, from the same side, at the same offset.
 * - The chevron is rendered plainly rather than through `Select.Icon`. That part
 *   renders "▼" as its own text when it is handed an element, so the trigger's
 *   accessible name came out as the value with an arrow glued to it.
 * - The parts this app does not use — groups, labels, separators and the scroll
 *   arrows — are not carried. `knip` fails on an export nothing imports, and a
 *   200-line ceiling holds every file here.
 * - No `"use client"`: there is no server renderer in this app.
 */

export const Select = SelectPrimitive.Root

export function SelectContent({
  align = 'start',
  children,
  className,
  side = 'bottom',
  sideOffset = 6,
  ...props
}: Pick<SelectPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'> &
  Readonly<SelectPrimitive.Popup.Props>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={false}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          className={cn(
            POPUP_SURFACE,
            'w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))]',
            className,
          )}
          data-slot="select-content"
          {...props}
        >
          <SelectPrimitive.List className={POPUP_LIST}>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({
  children,
  className,
  ...props
}: Readonly<SelectPrimitive.Item.Props>) {
  return (
    <SelectPrimitive.Item className={cn(POPUP_ITEM, className)} data-slot="select-item" {...props}>
      <SelectPrimitive.ItemText className="truncate">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export function SelectTrigger({
  children,
  className,
  ...props
}: Readonly<SelectPrimitive.Trigger.Props>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(POPUP_TRIGGER, className)}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      {/* The icon plainly, not through `Select.Icon`. That part renders "▼" as
          its own text when it is handed an element, so the trigger's accessible
          name became the team's name with an arrow glued to it — which a screen
          reader reads out and which an assertion on the name has to know
          about. */}
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none size-4 shrink-0 text-muted-foreground"
      />
    </SelectPrimitive.Trigger>
  )
}

export function SelectValue({ className, ...props }: Readonly<SelectPrimitive.Value.Props>) {
  return (
    <SelectPrimitive.Value
      className={cn('truncate text-left', className)}
      data-slot="select-value"
      {...props}
    />
  )
}
