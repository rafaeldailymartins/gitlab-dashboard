const hoursFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

const integerFormatter = new Intl.NumberFormat('pt-BR')

export function formatHours(hours: number | undefined) {
  if (hours === undefined) return '--'
  return `${hoursFormatter.format(hours)}h`
}

export function formatInteger(value: number | undefined) {
  if (value === undefined) return '--'
  return integerFormatter.format(value)
}

/** "2026-07-09" -> "qua, 09/07" */
export function formatDateLabel(isoDate: string) {
  const date = parseIsoDate(isoDate)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    weekday: 'short',
  }).format(date)
}

/** "2026-07-09" -> "quarta-feira, 9 de julho de 2026" */
export function formatFullDateLabel(isoDate: string) {
  const date = parseIsoDate(isoDate)
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(date)
}

function parseIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}
