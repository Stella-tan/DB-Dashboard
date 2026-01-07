"use client"

import { useEffect, useState, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { getSupabaseBrowserClient } from "@/lib/client"

interface DataSourceSelectorProps {
  databaseId: string | null
  value: {
    table: string
    xAxis: string
    yAxis: string[]
  }
  onChange: (value: { table: string; xAxis: string; yAxis: string[] }) => void
}

export function DataSourceSelector({ databaseId, value, onChange }: DataSourceSelectorProps) {
  const [tables, setTables] = useState<Array<{ table_name: string; schema_definition: any }>>([])
  const [columns, setColumns] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch tables only when databaseId changes
  useEffect(() => {
    if (!databaseId) {
      setTables([])
      return
    }

    // Prevent duplicate fetches
    let cancelled = false
    setIsLoading(true)

    const supabase = getSupabaseBrowserClient()
    supabase
      .from("synced_tables")
      .select(["table_name", "schema_definition"])
      .eq("database_id", databaseId)
      .then(({ data }) => {
        if (!cancelled && data) {
          setTables(data)
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [databaseId])

  useEffect(() => {
    if (value.table) {
      const selectedTable = tables.find((t) => t.table_name === value.table)
      if (selectedTable?.schema_definition?.columns) {
        setColumns(selectedTable.schema_definition.columns.map((c: any) => c.name))
      }
    }
  }, [value.table, tables])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="table">Data Table</Label>
        <Select value={value.table} onValueChange={(table) => onChange({ ...value, table, xAxis: "", yAxis: [] })}>
          <SelectTrigger id="table">
            <SelectValue placeholder="Select table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.table_name} value={table.table_name}>
                {table.table_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.table && (
        <>
          <div className="space-y-2">
            <Label htmlFor="xAxis">X-Axis</Label>
            <Select value={value.xAxis} onValueChange={(xAxis) => onChange({ ...value, xAxis })}>
              <SelectTrigger id="xAxis">
                <SelectValue placeholder="Select X-axis column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Y-Axis (Select multiple)</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-3">
              {columns.map((col) => (
                <div key={col} className="flex items-center gap-2">
                  <Checkbox
                    id={`y-${col}`}
                    checked={value.yAxis.includes(col)}
                    onCheckedChange={(checked) => {
                      const newYAxis = checked ? [...value.yAxis, col] : value.yAxis.filter((y) => y !== col)
                      onChange({ ...value, yAxis: newYAxis })
                    }}
                  />
                  <label htmlFor={`y-${col}`} className="text-sm cursor-pointer">
                    {col}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
