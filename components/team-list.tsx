"use client"

import { cn } from "@/lib/utils"
import type { Team } from "@/lib/database"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface TeamListProps {
  teams: Team[]
  selectedTeam: Team | null
  onSelectTeam: (team: Team) => void
}

export function TeamList({ teams, selectedTeam, onSelectTeam }: TeamListProps) {
  if (teams.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">No teams available</div>
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-2">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => onSelectTeam(team)}
            className={cn(
              "w-full text-left p-3 rounded-lg transition-colors",
              "hover:bg-accent",
              selectedTeam?.id === team.id && "bg-accent",
            )}
          >
            <div className="font-medium text-sm mb-1">{team.name}</div>
            {team.description && <p className="text-xs text-muted-foreground line-clamp-2">{team.description}</p>}
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                Team
              </Badge>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}
