import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-4 rounded-lg border bg-card py-4 text-card-foreground shadow-sm', className)}
      data-slot="card"
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 px-4', className)} data-slot="card-header" {...props} />
}

function CardTitle({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('font-semibold leading-none', className)} data-slot="card-title" {...props} />
}

function CardDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('text-sm text-muted-foreground', className)} data-slot="card-description" {...props} />
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-4', className)} data-slot="card-content" {...props} />
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle }
