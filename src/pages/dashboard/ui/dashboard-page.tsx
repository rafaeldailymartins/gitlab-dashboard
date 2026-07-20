import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ExternalLink, RefreshCw, TriangleAlert } from 'lucide-react'

import { timelogReportQueryOptions } from '@/entities/timelog'
import { PeriodFilter } from '@/features/period-filter'
import { ThemeToggle } from '@/features/theme-toggle'
import { UserFilter } from '@/features/user-filter'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { ErrorAlert } from '@/shared/ui/error-alert'
import { cn } from '@/shared/lib/utils'
import { DailyHoursTable } from '@/widgets/daily-hours-table'
import { PeriodSummary } from '@/widgets/period-summary'

const route = getRouteApi('/')

export function DashboardPage() {
  const navigate = route.useNavigate()
  const { days, user } = route.useSearch()
  const query = useQuery(timelogReportQueryOptions({ days, username: user }))
  const report = query.data

  const setDays = (nextDays: number) => {
    void navigate({ search: (prev) => ({ ...prev, days: nextDays }) })
  }
  const setUser = (username?: string) => {
    void navigate({ search: (prev) => ({ ...prev, user: username }) })
  }
  const openDay = (date: string) => {
    void navigate({ params: { date }, search: { days, user }, to: '/dias/$date' })
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="h-1 bg-tanuki" />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <a
                className="inline-flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
                href={report?.scope.url}
                rel="noreferrer"
                target="_blank"
              >
                GitLab · {report?.scope.fullPath ?? '...'}
                <ExternalLink className="size-3" />
              </a>
              <h1 className="font-display text-3xl font-semibold tracking-tight">Horas por dia</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Tempo registrado em issues e merge requests
                {report ? ` de ${report.period.from} ate ${report.period.to}` : ''}.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button
                aria-label="Atualizar dados"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
                size="icon"
                type="button"
                variant="ghost"
              >
                <RefreshCw className={cn(query.isFetching && 'animate-spin')} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PeriodFilter onChange={setDays} value={days} />
            <UserFilter onChange={setUser} users={report?.users ?? []} value={user} />
          </div>
        </div>
      </header>

      {query.error && (
        <ErrorAlert
          message={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          title="Falha ao consultar o GitLab"
        />
      )}

      {report?.truncated && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Relatorio parcial</AlertTitle>
          <AlertDescription>
            O periodo tem mais registros do que o limite de busca. Reduza o periodo para ver o total exato.
          </AlertDescription>
        </Alert>
      )}

      <PeriodSummary loading={query.isLoading} totals={report?.totals} />

      <DailyHoursTable loading={query.isLoading} onOpenDay={openDay} rows={report?.rows ?? []} showUsers={!user} />
    </main>
  )
}
