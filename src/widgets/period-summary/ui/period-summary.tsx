import { Clock3, ListChecks, TimerReset, Users } from 'lucide-react'
import type { ReactNode } from 'react'

import type { ReportTotals } from '@/entities/timelog'
import { formatHours, formatInteger } from '@/shared/lib/format'
import { Card, CardContent } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

type PeriodSummaryProps = {
  loading: boolean
  totals?: ReportTotals
}

export function PeriodSummary({ loading, totals }: PeriodSummaryProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={<Clock3 />} label="Horas no periodo" loading={loading} value={formatHours(totals?.hours)} />
      <Metric icon={<TimerReset />} label="Registros de tempo" loading={loading} value={formatInteger(totals?.entryCount)} />
      <Metric icon={<ListChecks />} label="Issues e MRs" loading={loading} value={formatInteger(totals?.itemCount)} />
      <Metric icon={<Users />} label="Pessoas" loading={loading} value={formatInteger(totals?.userCount)} />
    </section>
  )
}

function Metric({ icon, label, loading, value }: { icon: ReactNode; label: string; loading: boolean; value: string }) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
          <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground [&_svg]:size-4">
            {icon}
          </span>
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-24" />
        ) : (
          <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}
