import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

interface KPIDataRequest {
  databaseId: string
  kpi: {
    id: string
    title: string
    table: string
    column: string
    aggregation: string
    compareWith?: string
  }
}

interface SyncedTable {
  id: string
  table_name: string
}

interface DataRow {
  data: string
}

/**
 * Fetch data for a specific KPI based on AI configuration
 */
export async function POST(req: Request) {
  try {
    const { databaseId, kpi } = await req.json() as KPIDataRequest

    if (!databaseId || !kpi) {
      return NextResponse.json(
        { error: "databaseId and kpi configuration are required" },
        { status: 400 }
      )
    }

    // Get the synced table ID
    const syncedTables = await query<SyncedTable>(
      `SELECT id, table_name FROM synced_tables WHERE database_id = ? AND table_name = ?`,
      [databaseId, kpi.table]
    )

    if (syncedTables.length === 0) {
      return NextResponse.json({
        success: true,
        value: 0,
        message: `Table "${kpi.table}" not found or not synced`,
      })
    }

    const tableId = syncedTables[0].id

    // Get all data from the synced table
    const rows = await query<DataRow>(
      `SELECT data FROM synced_data WHERE synced_table_id = ?`,
      [tableId]
    )

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        value: 0,
        growth: 0,
        message: "No data available",
      })
    }

    // Parse all row data
    const parsedRows = rows.map(row => {
      try {
        return typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      } catch {
        return {}
      }
    }).filter(row => Object.keys(row).length > 0)

    // Calculate the KPI value
    const column = kpi.column
    const aggregation = kpi.aggregation

    const values = parsedRows.map(row => {
      const val = row[column]
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const parsed = parseFloat(val)
        return isNaN(parsed) ? 1 : parsed
      }
      return 1
    })

    let value: number
    switch (aggregation) {
      case "count":
        value = parsedRows.length
        break
      case "sum":
        value = values.reduce((a, b) => a + b, 0)
        break
      case "avg":
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
        break
      case "min":
        value = values.length > 0 ? values.reduce((min, v) => v < min ? v : min, values[0]) : 0
        break
      case "max":
        value = values.length > 0 ? values.reduce((max, v) => v > max ? v : max, values[0]) : 0
        break
      default:
        value = parsedRows.length
    }

    // Calculate growth if requested (comparing with previous period)
    let growth = 0
    if (kpi.compareWith === "previous_period") {
      // Find date column
      const dateColumn = findDateColumn(parsedRows)
      if (dateColumn) {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

        const recentRows = parsedRows.filter(row => {
          const date = parseDate(row[dateColumn])
          return date && date >= thirtyDaysAgo
        })

        const previousRows = parsedRows.filter(row => {
          const date = parseDate(row[dateColumn])
          return date && date >= sixtyDaysAgo && date < thirtyDaysAgo
        })

        const recentValue = calculateAggregation(recentRows, column, aggregation)
        const previousValue = calculateAggregation(previousRows, column, aggregation)

        if (previousValue > 0) {
          growth = ((recentValue - previousValue) / previousValue) * 100
        }
      }
    }

    return NextResponse.json({
      success: true,
      kpiId: kpi.id,
      value: Math.round(value * 100) / 100,
      growth: Math.round(growth * 10) / 10,
      rowCount: parsedRows.length,
    })
  } catch (error: unknown) {
    console.error("KPI data error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

function findDateColumn(rows: Record<string, unknown>[]): string | null {
  if (rows.length === 0) return null
  
  const firstRow = rows[0]
  const dateKeywords = ['created_at', 'updated_at', 'date', 'timestamp', 'time', 'created', 'modified']
  
  for (const key of Object.keys(firstRow)) {
    const lowerKey = key.toLowerCase()
    if (dateKeywords.some(keyword => lowerKey.includes(keyword))) {
      const value = firstRow[key]
      if (parseDate(value)) {
        return key
      }
    }
  }
  
  return null
}

function parseDate(value: unknown): Date | null {
  if (!value) return null
  
  if (value instanceof Date) return value
  
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!isNaN(date.getTime())) return date
  }
  
  if (typeof value === 'number') {
    const date = new Date(value > 1e12 ? value : value * 1000)
    if (!isNaN(date.getTime())) return date
  }
  
  return null
}

function calculateAggregation(
  rows: Record<string, unknown>[],
  column: string,
  aggregation: string
): number {
  const values = rows.map(row => {
    const val = row[column]
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? 1 : parsed
    }
    return 1
  })

  switch (aggregation) {
    case "count":
      return rows.length
    case "sum":
      return values.reduce((a, b) => a + b, 0)
    case "avg":
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
    case "min":
      return values.length > 0 ? values.reduce((min, v) => v < min ? v : min, values[0]) : 0
    case "max":
      return values.length > 0 ? values.reduce((max, v) => v > max ? v : max, values[0]) : 0
    default:
      return rows.length
  }
}

