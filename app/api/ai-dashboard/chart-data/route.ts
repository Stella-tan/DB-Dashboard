import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

interface ChartDataRequest {
  databaseId: string
  chart: {
    id: string
    title: string
    type: string
    table: string
    columns: {
      x?: string
      y: string
      groupBy?: string
    }
    aggregation: string
    dateRange?: string
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
 * Fetch data for a specific chart based on AI configuration
 */
export async function POST(req: Request) {
  try {
    const { databaseId, chart } = await req.json() as ChartDataRequest

    if (!databaseId || !chart) {
      return NextResponse.json(
        { error: "databaseId and chart configuration are required" },
        { status: 400 }
      )
    }

    // Get the synced table ID
    const syncedTables = await query<SyncedTable>(
      `SELECT id, table_name FROM synced_tables WHERE database_id = ? AND table_name = ?`,
      [databaseId, chart.table]
    )

    if (syncedTables.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: `Table "${chart.table}" not found or not synced`,
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
        data: [],
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

    // Process data based on chart type and configuration
    let chartData: Record<string, unknown>[] = []

    const xColumn = chart.columns.x
    const yColumn = chart.columns.y
    const groupBy = chart.columns.groupBy
    const aggregation = chart.aggregation

    if (chart.type === "pie" || groupBy) {
      // Group by a category
      const groupColumn = groupBy || xColumn
      const groups: Record<string, number[]> = {}

      parsedRows.forEach(row => {
        const groupValue = String(row[groupColumn!] || "Unknown")
        const value = parseFloat(row[yColumn]) || 1

        if (!groups[groupValue]) {
          groups[groupValue] = []
        }
        groups[groupValue].push(value)
      })

      chartData = Object.entries(groups).map(([name, values]) => {
        let value: number
        switch (aggregation) {
          case "count":
            value = values.length
            break
          case "sum":
            value = values.reduce((a, b) => a + b, 0)
            break
          case "avg":
            value = values.reduce((a, b) => a + b, 0) / values.length
            break
          case "min":
            value = values.length > 0 ? values.reduce((min, v) => v < min ? v : min, values[0]) : 0
            break
          case "max":
            value = values.length > 0 ? values.reduce((max, v) => v > max ? v : max, values[0]) : 0
            break
          default:
            value = values.length
        }
        return { name, value: Math.round(value * 100) / 100 }
      })
    } else if (xColumn && isDateColumn(parsedRows, xColumn)) {
      // Time series data
      const dateGroups: Record<string, number[]> = {}

      parsedRows.forEach(row => {
        const dateValue = row[xColumn]
        if (!dateValue) return

        const date = parseDate(dateValue)
        if (!date) return

        const dateKey = date.toISOString().split('T')[0]
        const value = parseFloat(row[yColumn]) || 1

        if (!dateGroups[dateKey]) {
          dateGroups[dateKey] = []
        }
        dateGroups[dateKey].push(value)
      })

      // Sort by date and format
      chartData = Object.entries(dateGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, values]) => {
          let value: number
          switch (aggregation) {
            case "count":
              value = values.length
              break
            case "sum":
              value = values.reduce((a, b) => a + b, 0)
              break
            case "avg":
              value = values.reduce((a, b) => a + b, 0) / values.length
              break
            case "min":
              value = values.length > 0 ? values.reduce((min, v) => v < min ? v : min, values[0]) : 0
              break
            case "max":
              value = values.length > 0 ? values.reduce((max, v) => v > max ? v : max, values[0]) : 0
              break
            default:
              value = values.length
          }
          
          const date = new Date(dateKey)
          const displayDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          
          return { date: displayDate, value: Math.round(value * 100) / 100 }
        })
    } else if (xColumn) {
      // Category-based data
      const categories: Record<string, number[]> = {}

      parsedRows.forEach(row => {
        const category = String(row[xColumn] || "Unknown")
        const value = parseFloat(row[yColumn]) || 1

        if (!categories[category]) {
          categories[category] = []
        }
        categories[category].push(value)
      })

      chartData = Object.entries(categories).map(([category, values]) => {
        let value: number
        switch (aggregation) {
          case "count":
            value = values.length
            break
          case "sum":
            value = values.reduce((a, b) => a + b, 0)
            break
          case "avg":
            value = values.reduce((a, b) => a + b, 0) / values.length
            break
          case "min":
            value = values.length > 0 ? values.reduce((min, v) => v < min ? v : min, values[0]) : 0
            break
          case "max":
            value = values.length > 0 ? values.reduce((max, v) => v > max ? v : max, values[0]) : 0
            break
          default:
            value = values.length
        }
        return { category, value: Math.round(value * 100) / 100 }
      })
    } else {
      // Just aggregate the y column
      const values = parsedRows.map(row => parseFloat(row[yColumn]) || 0)
      let total: number
      switch (aggregation) {
        case "count":
          total = values.length
          break
        case "sum":
          total = values.reduce((a, b) => a + b, 0)
          break
        case "avg":
          total = values.reduce((a, b) => a + b, 0) / values.length
          break
        case "min":
          total = values.length > 0 ? values.reduce((min, v) => v < min ? v : min, values[0]) : 0
          break
        case "max":
          total = values.length > 0 ? values.reduce((max, v) => v > max ? v : max, values[0]) : 0
          break
        default:
          total = values.length
      }
      chartData = [{ value: Math.round(total * 100) / 100 }]
    }

    return NextResponse.json({
      success: true,
      chartId: chart.id,
      data: chartData,
      rowCount: parsedRows.length,
    })
  } catch (error: unknown) {
    console.error("Chart data error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

function isDateColumn(rows: Record<string, unknown>[], column: string): boolean {
  // Check if the column contains date-like values
  const sampleValues = rows.slice(0, 10).map(row => row[column])
  return sampleValues.some(value => {
    if (!value) return false
    const date = parseDate(value)
    return date !== null
  })
}

function parseDate(value: unknown): Date | null {
  if (!value) return null
  
  if (value instanceof Date) return value
  
  if (typeof value === 'string') {
    // Try ISO format
    const isoDate = new Date(value)
    if (!isNaN(isoDate.getTime())) return isoDate
    
    // Try common formats
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
      /^\d{4}\/\d{2}\/\d{2}$/,  // YYYY/MM/DD
      /^\d{2}\/\d{2}\/\d{4}$/,  // MM/DD/YYYY
    ]
    
    for (const format of formats) {
      if (format.test(value)) {
        const parsed = new Date(value)
        if (!isNaN(parsed.getTime())) return parsed
      }
    }
  }
  
  if (typeof value === 'number') {
    // Unix timestamp
    const date = new Date(value > 1e12 ? value : value * 1000)
    if (!isNaN(date.getTime())) return date
  }
  
  return null
}

