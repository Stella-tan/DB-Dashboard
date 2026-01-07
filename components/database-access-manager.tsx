"use client"

import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Database } from "lucide-react"
import type { ExternalDatabase } from "@/lib/database"
import { getSupabaseBrowserClient } from "@/lib/client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

interface DatabaseAccessManagerProps {
  teamId: string
  databases: ExternalDatabase[]
}

export function DatabaseAccessManager({ teamId, databases }: DatabaseAccessManagerProps) {
  const [accessMap, setAccessMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseBrowserClient()
  const { toast } = useToast()

  useEffect(() => {
    async function loadAccess() {
      const { data } = await supabase.from("team_database_access").select("database_id").eq("team_id", teamId)

      if (data) {
        const map: Record<string, boolean> = {}
        data.forEach((access) => {
          map[access.database_id] = true
        })
        setAccessMap(map)
      }
      setLoading(false)
    }

    loadAccess()
  }, [teamId])

  const toggleAccess = async (databaseId: string, hasAccess: boolean) => {
    if (hasAccess) {
      // Grant access
      const { error } = await supabase.from("team_database_access").insert({ team_id: teamId, database_id: databaseId })

      if (error) {
        toast({
          title: "Error",
          description: "Failed to grant database access",
          variant: "destructive",
        })
        return
      }

      setAccessMap((prev) => ({ ...prev, [databaseId]: true }))
      toast({
        title: "Access Granted",
        description: "Team can now access this database",
      })
    } else {
      // Revoke access
      const { error } = await supabase
        .from("team_database_access")
        .delete()
        .eq("team_id", teamId)
        .eq("database_id", databaseId)

      if (error) {
        toast({
          title: "Error",
          description: "Failed to revoke database access",
          variant: "destructive",
        })
        return
      }

      setAccessMap((prev) => ({ ...prev, [databaseId]: false }))
      toast({
        title: "Access Revoked",
        description: "Team can no longer access this database",
      })
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Loading database access...</div>
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {databases.map((db) => (
          <div key={db.id} className="flex items-start gap-3 p-3 rounded-lg border">
            <Checkbox
              id={`db-${db.id}`}
              checked={accessMap[db.id] || false}
              onCheckedChange={(checked) => toggleAccess(db.id, checked as boolean)}
            />
            <div className="flex-1">
              <Label htmlFor={`db-${db.id}`} className="flex items-center gap-2 cursor-pointer">
                <Database className="w-4 h-4 text-primary" />
                <span className="font-medium">{db.name}</span>
              </Label>
              {db.description && <p className="text-xs text-muted-foreground mt-1">{db.description}</p>}
              <div className="flex gap-2 mt-2">
                <Badge variant={db.sync_status === "active" ? "default" : "secondary"} className="text-xs">
                  {db.sync_status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {db.database_type}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
