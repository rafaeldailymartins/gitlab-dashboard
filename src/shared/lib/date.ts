/** Converte um instante ISO para a data local (YYYY-MM-DD) no fuso informado. */
export function dateInTimeZone(isoDateTime: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).format(new Date(isoDateTime))
}

/** Data de hoje (YYYY-MM-DD) no fuso informado. */
export function todayInTimeZone(timeZone: string) {
  return dateInTimeZone(new Date().toISOString(), timeZone)
}

/** Soma dias a uma data YYYY-MM-DD. */
export function addDays(isoDate: string, delta: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10)
}
