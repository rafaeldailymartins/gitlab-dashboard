import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/input'

/*
 * Three deviations from what `shadcn add combobox` writes, all to be kept if
 * this component is ever regenerated.
 *
 * - The field is our own `Input` with a chevron laid over it, rather than the
 *   generated `InputGroup` wrapper. That wrapper arrived with two components
 *   nothing else here uses — and its addon is a `role="group"` div carrying a
 *   click handler that focuses the input, which is a control the keyboard
 *   cannot reach. Clicking the field already opens the popup
 *   (`openOnInputClick` defaults to true), so the chevron is an affordance, not
 *   a control: it is `aria-hidden` and takes no pointer events, and the click
 *   lands on the input underneath it.
 * - The parts this app does not use — chips, groups, collections, separators —
 *   are not carried. `knip` fails on an export nothing imports, and a
 *   200-line ceiling holds every file here.
 * - No `"use client"`: there is no server renderer in this app.
 */

export const Combobox = ComboboxPrimitive.Root

const CONTENT =
  'group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'

const ITEM =
  "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const LIST =
  'max-h-[min(--spacing(72),var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0'

export function ComboboxContent({
  align = 'start',
  alignOffset = 0,
  className,
  side = 'bottom',
  sideOffset = 6,
  ...props
}: Pick<ComboboxPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'> &
  Readonly<ComboboxPrimitive.Popup.Props>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <ComboboxPrimitive.Popup
          className={cn(CONTENT, className)}
          data-slot="combobox-content"
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

export function ComboboxEmpty({ className, ...props }: Readonly<ComboboxPrimitive.Empty.Props>) {
  return (
    <ComboboxPrimitive.Empty
      className={cn(
        'hidden w-full justify-center py-3 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex',
        className,
      )}
      data-slot="combobox-empty"
      {...props}
    />
  )
}

export function ComboboxInput({ className, ...props }: Readonly<ComboboxPrimitive.Input.Props>) {
  return (
    <div className="relative">
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        render={<Input className={cn('pr-8', className)} />}
        {...props}
      />
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-2.5 my-auto size-4 text-muted-foreground"
      />
    </div>
  )
}

export function ComboboxItem({
  children,
  className,
  ...props
}: Readonly<ComboboxPrimitive.Item.Props>) {
  return (
    <ComboboxPrimitive.Item className={cn(ITEM, className)} data-slot="combobox-item" {...props}>
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

export function ComboboxList({ className, ...props }: Readonly<ComboboxPrimitive.List.Props>) {
  return (
    <ComboboxPrimitive.List className={cn(LIST, className)} data-slot="combobox-list" {...props} />
  )
}
