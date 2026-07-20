import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { timelogReportQueryOptions } from '@/entities/timelog'
import { formatFullDateLabel, formatHours, formatInteger } from '@/shared/lib/format'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ErrorAlert } from '@/shared/ui/error-alert'
import { Skeleton } from '@/shared/ui/skeleton'
import { HoursBar } from '@/widgets/daily-hours-table'

const route = getRouteApi('/dias/$date')

export function DayDetailPage() {
  const { date } = route.useParams()
  const { days, user } = route.useSearch()
  const query = useQuery(timelogReportQueryOptions({ days, username: user }))
  const day = query.data?.rows.find((row) => row.date === date)

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Button asChild size="sm" variant="ghost">
          <Link search={{ days, user }} to="/">
            <ArrowLeft />
            Voltar ao dashboard
          </Link>
        </Button>
      </div>

      <header className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="h-1 bg-tanuki" />
        <div className="space-y-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <span>Detalhe do dia</span>
            {user && <Badge variant="secondary">@{user}</Badge>}
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight capitalize sm:text-3xl">
            {formatFullDateLabel(date)}
          </h1>
          {query.isLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <div className="max-w-sm space-y-2">
              <div className="font-display text-3xl font-semibold tabular-nums">{formatHours(day?.hours ?? 0)}</div>
              <HoursBar hours={day?.hours ?? 0} />
              <p className="text-sm text-muted-foreground">
                {formatInteger(day?.entryCount ?? 0)} registros de tempo
              </p>
            </div>
          )}
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

      {!query.isLoading && !query.error && !day && (
        <Alert>
          <AlertTitle>Sem registros neste dia</AlertTitle>
          <AlertDescription>
            Nao ha tempo registrado em {formatFullDateLabel(date)} dentro do periodo selecionado ({days} dias).
          </AlertDescription>
        </Alert>
      )}

      {day && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Issues e merge requests</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {day.items.map((item) => (
                <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0" key={item.key}>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.type === 'issue' ? 'Issue' : 'MR'}</Badge>
                      <a
                        className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary hover:underline"
                        href={item.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {item.key}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{item.title}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{formatHours(item.hours)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatInteger(item.entryCount)} {item.entryCount === 1 ? 'registro' : 'registros'}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display">Horas por pessoa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {day.users.map((person) => (
                <div className="space-y-1.5" key={person.username}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="min-w-0 truncate font-medium">
                      {person.name} <span className="font-normal text-muted-foreground">@{person.username}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatHours(person.hours)}</span>
                  </div>
                  <HoursBar hours={person.hours} />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
