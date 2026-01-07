"use client"

import type { ExternalDatabase } from "@/lib/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Filter, PanelLeft } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ChartBuilderDialog } from "./chart-builder-dialog"

interface DashboardHeaderProps {
  database?: ExternalDatabase
  onMenuClick: () => void
  sidebarOpen: boolean
}

export function DashboardHeader({ database, onMenuClick, sidebarOpen }: DashboardHeaderProps) {
  return (
    <header className="border-b bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onMenuClick}>
            <PanelLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-2xl mb-1">{database ? database.name : "Analytics Dashboard"}</h1>
          {database && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                Last synced{" "}
                {database.last_synced_at
                  ? formatDistanceToNow(new Date(database.last_synced_at), {
                      addSuffix: true,
                    })
                  : "never"}
              </span>
              <Badge variant={database.sync_status === "active" ? "default" : "secondary"}>
                {database.sync_status}
              </Badge>
            </div>
          )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <ChartBuilderDialog databaseId={database?.id || null} />
        </div>
      </div>
    </header>
  )
}
