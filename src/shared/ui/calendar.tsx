import * as React from 'react'
import { DayPicker, getDefaultClassNames, type DayButton } from '@daypicker/react'

import { cn } from '@/shared/lib/utils'
import { Button, buttonVariants } from '@/shared/ui/button'
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from 'lucide-react'

/*
 * Five deviations from what `shadcn add calendar` writes, all to be kept if
 * this component is ever regenerated.
 *
 * - `cn` comes from `@/shared/lib/utils`. The generator wrote `from "cn"` and
 *   installed an unrelated package of that name, as it did for the dialog.
 * - DayPicker is imported from `@daypicker/react`, the name v10 publishes
 *   under. The generator installed `react-day-picker`, which v10 keeps only as a
 *   compatibility alias of the same code.
 * - Its modifiers are read by index, which this repository's
 *   `noPropertyAccessFromIndexSignature` requires of the generated code.
 * - The parts it hands DayPicker — the root, the chevron, the week number and
 *   the day button — are components at module level. The generator wrote them as
 *   arrow functions inside `Calendar`, a new component type on every render, so
 *   React remounted each day button every time the calendar rendered. The day
 *   button also now receives the ref its focus effect reads; as generated the
 *   ref was never attached, and the effect could not move focus.
 * - `CalendarDayButton` is not exported. Nothing outside this file renders one,
 *   and `knip` refuses an export nobody imports.
 *
 * Every visible string comes from the caller through `formatters` and `labels`:
 * the defaults are date-fns' English, and this app writes dates through `Intl`
 * and words through Paraglide.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        'group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString(locale?.code, { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn('relative flex flex-col gap-4 md:flex-row', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn('relative rounded-(--cell-radius)', defaultClassNames.dropdown_root),
        dropdown: cn('absolute inset-0 bg-popover opacity-0', defaultClassNames.dropdown),
        caption_label: cn(
          'font-medium select-none',
          captionLayout === 'label'
            ? 'text-sm'
            : 'flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
          defaultClassNames.caption_label,
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none',
          defaultClassNames.weekday,
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        week_number_header: cn('w-(--cell-size) select-none', defaultClassNames.week_number_header),
        week_number: cn(
          'text-[0.8rem] text-muted-foreground select-none',
          defaultClassNames.week_number,
        ),
        day: cn(
          'group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)',
          props.showWeekNumber
            ? '[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)'
            : '[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)',
          defaultClassNames.day,
        ),
        range_start: cn(
          'relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted',
          defaultClassNames.range_start,
        ),
        range_middle: cn('rounded-none', defaultClassNames.range_middle),
        range_end: cn(
          'relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted',
          defaultClassNames.range_end,
        ),
        today: cn(
          'rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none',
          defaultClassNames.today,
        ),
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside,
        ),
        disabled: cn('text-muted-foreground opacity-50', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        Root: CalendarRoot,
        WeekNumber: CalendarWeekNumber,
        ...components,
      }}
      {...props}
    />
  )
}

/** The parts DayPicker lets a caller replace, typed from DayPicker itself. */
type Parts = NonNullable<React.ComponentProps<typeof DayPicker>['components']>
type PropsOf<K extends keyof Parts> = React.ComponentProps<NonNullable<Parts[K]>>

function CalendarRoot({ className, rootRef, ...props }: Readonly<PropsOf<'Root'>>) {
  return <div className={cn(className)} data-slot="calendar" ref={rootRef} {...props} />
}

function CalendarChevron({ className, orientation, ...props }: Readonly<PropsOf<'Chevron'>>) {
  if (orientation === 'left') {
    return <ChevronLeftIcon className={cn('size-4', className)} {...props} />
  }

  if (orientation === 'right') {
    return <ChevronRightIcon className={cn('size-4', className)} {...props} />
  }

  return <ChevronDownIcon className={cn('size-4', className)} {...props} />
}

function CalendarWeekNumber({ children, ...props }: Readonly<PropsOf<'WeekNumber'>>) {
  return (
    <td {...props}>
      <div className="flex size-(--cell-size) items-center justify-center text-center">
        {children}
      </div>
    </td>
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: Readonly<React.ComponentProps<typeof DayButton>>) {
  const defaultClassNames = getDefaultClassNames()
  const focused = modifiers['focused'] === true
  const single =
    modifiers['selected'] === true &&
    modifiers['range_start'] !== true &&
    modifiers['range_end'] !== true &&
    modifiers['range_middle'] !== true

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (focused) {
      ref.current?.focus()
    }
  }, [focused])

  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.isoDate}
      data-selected-single={single}
      data-range-start={modifiers['range_start']}
      data-range-end={modifiers['range_end']}
      data-range-middle={modifiers['range_middle']}
      className={cn(
        'relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className,
      )}
      ref={ref}
      {...props}
    />
  )
}

export { Calendar }
