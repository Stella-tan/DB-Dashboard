"use client"

import { useState } from "react"
import type { ExternalDatabase } from "@/lib/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Filter, PanelLeft, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ChartBuilderDialog } from "./chart-builder-dialog"
import { useToast } from "@/hooks/use-toast"

interface ChartConfig {
  title: string
  chartType: string
  dataSource: {
    table: string
    xAxis: string
    yAxis: string[]
  }
  filters: Array<{
    field: string
    operator: string
    value: string
  }>
  aggregation: string
  groupBy: string
}

interface DashboardHeaderProps {
  database?: ExternalDatabase
  onMenuClick: () => void
  sidebarOpen: boolean
  onChartSaved?: () => void
}

export function DashboardHeader({ database, onMenuClick, sidebarOpen, onChartSaved }: DashboardHeaderProps) {
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const handleSaveChart = async (config: ChartConfig) => {
    if (!database?.id) {
      toast({
        title: "Error",
        description: "Please select a database first",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/ai-dashboard/custom-charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseId: database.id,
          config,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save chart")
      }

      toast({
        title: "Chart Saved",
        description: `"${config.title}" has been added to your dashboard`,
      })

      // Notify parent to refresh charts
      onChartSaved?.()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

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
          <ChartBuilderDialog 
            databaseId={database?.id || null} 
            onSave={handleSaveChart}
            isSaving={isSaving}
          />
        </div>
      </div>
    </header>
  )
}
