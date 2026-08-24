import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { cn } from '@/shared/lib/utils'

/*
 * One deviation from what `shadcn add input` writes, to be kept if this is ever
 * regenerated: the invalid border is full-alpha in dark mode too. As generated
 * it is `dark:aria-invalid:border-destructive/50`, which composites to #814e41
 * over a card — 2.63:1, under the 3:1 a state boundary needs, and unfixable by
 * colour because 50% alpha over #121917 caps at 5.26:1 even for pure white. The
 * ring stays at /20 and /40: it is glow, and the border is the indicator.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
