import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'

type ErrorAlertProps = {
  message: string
  onRetry: () => void
  retrying?: boolean
  title: string
}

export function ErrorAlert({ message, onRetry, retrying, title }: ErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Button disabled={retrying} onClick={onRetry} size="sm" type="button" variant="outline">
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  )
}
