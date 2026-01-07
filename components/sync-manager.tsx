"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Play, CheckCircle2, XCircle, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ExternalDatabase } from "@/lib/database"

interface SyncManagerProps {
  database: ExternalDatabase
  onSyncComplete?: () => void
}

/**
 * SyncManager Component
 * 
 * This component allows MANUAL synchronization of data from client's Supabase
 * to local storage. After sync, all UI queries will read from local storage,
 * not from the client's database.
 */

export function SyncManager({ database, onSyncComplete }: SyncManagerProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncingTable, setSyncingTable] = useState<string | null>(null)
  const { toast } = useToast()

  /**
   * Manual sync: Fetch data from client's Supabase and store in local storage
   * After this, all queries will read from local storage, not client's database
   */
  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/sync/sync-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ databaseId: database.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Sync failed")
      }

      toast({
        title: "Sync Completed",
        description: result.message || `Synced ${result.summary?.totalRows || 0} rows to local storage`,
      })

      onSyncComplete?.()
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
      setSyncingTable(null)
    }
  }

  /**
   * Manual sync for a single table
   * Fetches from client's Supabase and stores in local storage
   */
  const handleSyncTable = async (tableName: string) => {
    setSyncing(true)
    setSyncingTable(tableName)
    try {
      const response = await fetch("/api/sync/sync-table", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          databaseId: database.id,
          tableName,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Sync failed")
      }

      toast({
        title: "Sync Completed",
        description: result.message || `Synced ${result.rowsSynced || 0} rows from ${tableName} to local storage`,
      })

      onSyncComplete?.()
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
      setSyncingTable(null)
    }
  }

  const getStatusBadge = () => {
    switch (database.sync_status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">Active</Badge>
      case "syncing":
        return <Badge variant="default" className="bg-yellow-500">Syncing</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{database.name}</CardTitle>
            <CardDescription>{database.description || "External database"}</CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last Synced:</span>
          <span>
            {database.last_synced_at
              ? new Date(database.last_synced_at).toLocaleString()
              : "Never"}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSyncAll}
            disabled={syncing}
            className="flex-1"
            variant="default"
          >
            {syncing && syncingTable === null ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing All...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Sync All Tables
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Connection: {database.database_type}</p>
          <p>Schedule: {database.sync_schedule || "manual"}</p>
        </div>
      </CardContent>
    </Card>
  )
}

