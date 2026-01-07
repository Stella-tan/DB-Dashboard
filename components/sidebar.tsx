"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { ExternalDatabase } from "@/lib/database"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronDown, ChevronRight, Database, Settings, Users, Table2, Loader2, Plus } from "lucide-react"
import Link from "next/link"
import { AddDatabaseDialog } from "./add-database-dialog"

interface SyncedTable {
  id: string
  table_name: string
  row_count: number
  last_synced_at: string | null
}

interface SidebarProps {
  open: boolean
  onToggle: () => void
  databases: ExternalDatabase[]
  selectedDatabaseId: string | null
  onDatabaseSelect: (id: string) => void
  onDatabaseAdded?: () => void
}

export function Sidebar({ open, onToggle, databases, selectedDatabaseId, onDatabaseSelect, onDatabaseAdded }: SidebarProps) {
  const [expandedDatabases, setExpandedDatabases] = useState<Record<string, boolean>>({})
  const [tablesMap, setTablesMap] = useState<Record<string, SyncedTable[]>>({})
  const [loadingTables, setLoadingTables] = useState<Record<string, boolean>>({})

  const toggleExpand = async (dbId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const isExpanding = !expandedDatabases[dbId]
    setExpandedDatabases(prev => ({ ...prev, [dbId]: isExpanding }))
    
    // Fetch tables if expanding and not already loaded
    if (isExpanding && !tablesMap[dbId]) {
      setLoadingTables(prev => ({ ...prev, [dbId]: true }))
      try {
        const response = await fetch('/api/mysql/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'synced_tables',
            columns: 'id, table_name, row_count, last_synced_at',
            filters: [{ column: 'database_id', operator: 'eq', value: dbId }]
          })
        })
        const result = await response.json()
        if (result.data) {
          setTablesMap(prev => ({ ...prev, [dbId]: result.data }))
        }
      } catch (error) {
        console.error('Failed to fetch tables:', error)
      } finally {
        setLoadingTables(prev => ({ ...prev, [dbId]: false }))
      }
    }
  }

  return (
    <aside className={cn("border-r bg-card transition-all duration-300", open ? "w-64" : "w-0")}>
      {open && (
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold text-lg">Databases</h2>
            <div className="flex items-center gap-1">
              <AddDatabaseDialog onDatabaseAdded={onDatabaseAdded}>
                <Button variant="ghost" size="icon" title="Add Database">
                  <Plus className="w-4 h-4" />
                </Button>
              </AddDatabaseDialog>
              <Button variant="ghost" size="icon" onClick={onToggle}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Database List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 p-4">
              {databases.map((db) => (
                <div key={db.id} className="space-y-1">
                  {/* Database Item */}
                  <div
                    onClick={() => onDatabaseSelect(db.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-colors cursor-pointer",
                      "hover:bg-accent",
                      selectedDatabaseId === db.id && "bg-accent",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {/* Expand/Collapse Button */}
                      <button
                        onClick={(e) => toggleExpand(db.id, e)}
                        className="mt-0.5 p-0.5 hover:bg-muted rounded"
                      >
                        {loadingTables[db.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : expandedDatabases[db.id] ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                      
                      <Database className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm mb-1">{db.name}</div>
                        {db.description && <p className="text-xs text-muted-foreground line-clamp-2">{db.description}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={db.sync_status === "active" ? "default" : "secondary"} className="text-xs">
                            {db.sync_status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{db.database_type}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tables List (Expanded) */}
                  {expandedDatabases[db.id] && (
                    <div className="ml-6 pl-4 border-l border-muted space-y-1">
                      {loadingTables[db.id] ? (
                        <div className="py-2 px-3 text-xs text-muted-foreground">
                          Loading tables...
                        </div>
                      ) : tablesMap[db.id]?.length === 0 ? (
                        <div className="py-2 px-3 text-xs text-muted-foreground">
                          No tables synced yet
                        </div>
                      ) : (
                        tablesMap[db.id]?.map((table) => (
                          <div
                            key={table.id}
                            className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer"
                          >
                            <Table2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{table.table_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {table.row_count.toLocaleString()} rows
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Sidebar Footer */}
          <div className="p-4 border-t space-y-2">
            <Link href="/teams">
              <Button variant="outline" className="w-full justify-start bg-transparent" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Teams
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start bg-transparent" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      )}
    </aside>
  )
}
