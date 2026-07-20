import { Check, ChevronsUpDown, UserSearch, Users } from 'lucide-react'
import { useState } from 'react'

import type { TimelogUser } from '@/entities/timelog'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

type UserFilterProps = {
  onChange: (username?: string) => void
  users: TimelogUser[]
  value?: string
}

export function UserFilter({ onChange, users, value }: UserFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = users.find((user) => user.username === value)
  const typedUsername = search.trim().replace(/^@/, '')

  const apply = (username?: string) => {
    onChange(username)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button aria-expanded={open} className="min-w-48 justify-between font-normal" role="combobox" variant="outline">
          <span className="flex min-w-0 items-center gap-2">
            <Users className="shrink-0 text-muted-foreground" />
            <span className="truncate">{selected ? selected.name : value ? `@${value}` : 'Todos os usuarios'}</span>
          </span>
          <ChevronsUpDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput onValueChange={setSearch} placeholder="Pesquisar por nome ou @username..." value={search} />
          <CommandList>
            <CommandEmpty>
              {typedUsername ? (
                <button
                  className="mx-auto flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                  onClick={() => apply(typedUsername)}
                  type="button"
                >
                  <UserSearch className="size-4 text-muted-foreground" />
                  Filtrar por @{typedUsername}
                </button>
              ) : (
                'Nenhum usuario encontrado.'
              )}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => apply(undefined)} value="todos os usuarios">
                <Users className="text-muted-foreground" />
                Todos os usuarios
                <Check className={cn('ml-auto', value ? 'opacity-0' : 'opacity-100')} />
              </CommandItem>
              {users.map((user) => (
                <CommandItem
                  key={user.username}
                  onSelect={() => apply(user.username)}
                  value={`${user.name} @${user.username}`}
                >
                  <span className="min-w-0 truncate">
                    {user.name} <span className="text-muted-foreground">@{user.username}</span>
                  </span>
                  <Check className={cn('ml-auto', value === user.username ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
