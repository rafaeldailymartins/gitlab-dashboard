/**
 * What every dropdown in this app looks like, in one place.
 *
 * There are two of them and they answer different questions. A **combobox** is
 * for a list that comes from the provider a page at a time and has to be typed
 * at — thousands of groups. A **select** is for a list already in hand and short
 * enough to read — a reader's own teams. They are not interchangeable and
 * neither should be built out of the other.
 *
 * They still have to look like the same control, because they stand next to each
 * other in the report's toolbar. That is what these constants are: the surface,
 * the rows, the scrolling list and the closed control, shared by both rather
 * than written twice and drifting apart. The pair drifted once already — one was
 * a native `<select>`, so one opened the app's own panel and the other opened the
 * operating system's, in a different font, a different width and a different
 * highlight colour, six pixels apart.
 *
 * Anything new that opens a list uses these. A dropdown that needs to look
 * different is a decision to record, not a class list to invent.
 */

/**
 * The floating panel itself.
 *
 * `--transform-origin` and `--anchor-width` are Base UI's, set by the positioner,
 * so the panel grows out of the control it belongs to and is at least as wide.
 */
export const POPUP_SURFACE =
  'origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'

/**
 * One row.
 *
 * Both highlight selectors are carried: Base UI marks a combobox row with
 * `data-highlighted` and a select row with `:focus`, and a row that lights up in
 * one list and not the other is the drift this module exists to stop.
 */
export const POPUP_ITEM =
  "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** The scrolling list the rows sit in, bounded by the space the positioner found. */
export const POPUP_LIST =
  'max-h-[min(--spacing(72),var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0'

/**
 * The closed control.
 *
 * Deliberately the same declarations `Input` carries, because the combobox's
 * closed state *is* an `Input` and the select's is a button. Two controls that
 * are a pixel apart on the same row read as a mistake, and there is no token
 * that would hold them together on its own.
 */
export const POPUP_TRIGGER =
  'flex min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30'

/**
 * How big a closed control is on the report's toolbar.
 *
 * One constant rather than a number in each file: the two of them sit side by
 * side, so a width that is right for one and wrong for the other is a ragged row
 * — which is exactly what the toolbar was before, and it was two controls that
 * had each been sized on their own.
 */
export const POPUP_FIELD = 'h-9 w-56'
