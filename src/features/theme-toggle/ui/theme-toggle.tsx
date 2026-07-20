import { Moon, Sun } from 'lucide-react'

import { Button } from '@/shared/ui/button'

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }

  return (
    <Button aria-label="Alternar tema" onClick={toggle} size="icon" type="button" variant="ghost">
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}
