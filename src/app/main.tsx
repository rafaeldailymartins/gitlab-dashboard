import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { reportRenderFault, startMonitoring } from '@/app/lib/monitoring'
import { router } from '@/app/router'
import '@/app/styles.css'

// Before anything renders, so a fault in the first render is held, not lost.
startMonitoring()

const rootElement = document.querySelector('#root')

if (!rootElement) {
  throw new Error('Missing #root element in index.html')
}

createRoot(rootElement, {
  // Every error a boundary drew — the router's own included, which tells nobody
  // in production — and every one nothing caught. Nothing drawn changes.
  onCaughtError: (error) => {
    reportRenderFault(error)
  },
  onUncaughtError: (error) => {
    reportRenderFault(error)
  },
}).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
