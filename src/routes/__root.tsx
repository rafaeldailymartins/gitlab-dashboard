import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import appCss from '@/app/styles.css?url'

const themeInitScript = `(function () {
  try {
    var stored = localStorage.getItem('theme')
    var dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  } catch (_) {}
})()`

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { title: 'GitLab Dashboard - Horas por dia' },
      { content: 'Relatorio de horas registradas por dia em issues e MRs do GitLab', name: 'description' },
    ],
    links: [
      { href: appCss, rel: 'stylesheet' },
      { href: '/favicon.svg', rel: 'icon', type: 'image/svg+xml' },
      { href: 'https://fonts.googleapis.com', rel: 'preconnect' },
      { crossOrigin: 'anonymous', href: 'https://fonts.gstatic.com', rel: 'preconnect' },
      {
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap',
        rel: 'stylesheet',
      },
    ],
    scripts: [{ children: themeInitScript }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
