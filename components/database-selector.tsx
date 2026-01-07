"use client"

import { Check, ChevronsUpDown, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useState } from "react"
import type { ExternalDatabase } from "@/lib/database"

interface DatabaseSelectorProps {
  databases: ExternalDatabase[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function DatabaseSelector({ databases, selectedId, onSelect }: DatabaseSelectorProps) {
  const [open, setOpen] = useState(false)
  const selectedDatabase = databases.find((db) => db.id === selectedId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-transparent"
        >
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            {selectedDatabase ? selectedDatabase.name : "Select database..."}
          </div>
          <ChevronsUpDown className="ml-2 w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search databases..." />
          <CommandList>
            <CommandEmpty>No database found.</CommandEmpty>
            <CommandGroup>
              {databases.map((db) => (
                <CommandItem
                  key={db.id}
                  value={db.name}
                  onSelect={() => {
                    onSelect(db.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedId === db.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex-1">
                    <div className="font-medium">{db.name}</div>
                    {db.description && <div className="text-xs text-muted-foreground">{db.description}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
