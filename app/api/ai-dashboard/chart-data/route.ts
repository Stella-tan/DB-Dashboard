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

interface GroupedResult {
  group_key: string
  result: string | number
}

interface SingleResult {
  result: string | number
  row_count: number
}

/**
 * Fetch chart data using MySQL aggregation for better performance
 * OPTIMIZED: Uses denormalized database_id/table_name columns to avoid JOINs
 * With improved date handling for multiple formats
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

    const { table, columns, aggregation, type } = chart
    const xColumn = columns.x
    const yColumn = columns.y
    const groupBy = columns.groupBy

    // Build the aggregation expression
    const yPath = `$.${yColumn}`
    let aggregationExpr: string

    switch (aggregation) {
      case "count":
        aggregationExpr = `COUNT(*)`
        break
      case "sum":
        aggregationExpr = `COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${yPath}')) AS DECIMAL(20,2))), 0)`
        break
      case "avg":
        aggregationExpr = `COALESCE(AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${yPath}')) AS DECIMAL(20,2))), 0)`
        break
      case "min":
        aggregationExpr = `COALESCE(MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${yPath}')) AS DECIMAL(20,2))), 0)`
        break
      case "max":
        aggregationExpr = `COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${yPath}')) AS DECIMAL(20,2))), 0)`
        break
      default:
        aggregationExpr = `COUNT(*)`
    }

    let chartData: Record<string, unknown>[] = []

    // Determine the query type based on chart configuration
    if (type === "pie" || groupBy) {
      // Group by a category column
      const groupColumn = groupBy || xColumn
      if (!groupColumn) {
        return NextResponse.json({
          success: true,
          chartId: chart.id,
          data: [],
          message: "No group column specified for pie chart",
        })
      }

      const groupPath = `$.${groupColumn}`
      // OPTIMIZED: Query directly on synced_data using denormalized columns
      const results = await query<GroupedResult>(
        `SELECT 
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '${groupPath}')), 'Unknown') as group_key,
          ${aggregationExpr} as result
         FROM synced_data
         WHERE database_id = ? AND table_name = ?
         GROUP BY group_key
         ORDER BY result DESC
         LIMIT 20`,
        [databaseId, table]
      )

      chartData = results.map(row => ({
        name: String(row.group_key),
        value: Math.round(parseFloat(String(row.result)) * 100) / 100
      }))

    } else if (xColumn) {
      // Check if x column looks like a date column
      const dateKeywords = ['created_at', 'updated_at', 'date', 'timestamp', 'time', 'created', 'modified']
      const isDateCol = dateKeywords.some(kw => xColumn.toLowerCase().includes(kw))

      if (isDateCol) {
        // Time series - try to group by date with multiple format support
        const xPath = `$.${xColumn}`
        
        // Try multiple date parsing approaches
        let results: GroupedResult[] = []
        
        // Approach 1: ISO format with T (2024-01-01T10:00:00)
        try {
          results = await query<GroupedResult>(
            `SELECT 
              DATE(STR_TO_DATE(
                JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), 
                '%Y-%m-%dT%H:%i:%s'
              )) as group_key,
              ${aggregationExpr} as result
             FROM synced_data
             WHERE database_id = ? 
               AND table_name = ?
               AND JSON_EXTRACT(data, '${xPath}') IS NOT NULL
               AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), '%Y-%m-%dT%H:%i:%s') IS NOT NULL
             GROUP BY group_key
             ORDER BY group_key ASC
             LIMIT 60`,
            [databaseId, table]
          )
        } catch { /* Try next format */ }

        // Approach 2: ISO format without T (2024-01-01 10:00:00)
        if (results.length === 0) {
          try {
            results = await query<GroupedResult>(
              `SELECT 
                DATE(STR_TO_DATE(
                  JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), 
                  '%Y-%m-%d %H:%i:%s'
                )) as group_key,
                ${aggregationExpr} as result
               FROM synced_data
               WHERE database_id = ? 
                 AND table_name = ?
                 AND JSON_EXTRACT(data, '${xPath}') IS NOT NULL
                 AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), '%Y-%m-%d %H:%i:%s') IS NOT NULL
               GROUP BY group_key
               ORDER BY group_key ASC
               LIMIT 60`,
              [databaseId, table]
            )
          } catch { /* Try next format */ }
        }

        // Approach 3: Unix timestamp (seconds)
        if (results.length === 0) {
          try {
            results = await query<GroupedResult>(
              `SELECT 
                DATE(FROM_UNIXTIME(
                  CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')) AS UNSIGNED)
                )) as group_key,
                ${aggregationExpr} as result
               FROM synced_data
               WHERE database_id = ? 
                 AND table_name = ?
                 AND JSON_EXTRACT(data, '${xPath}') IS NOT NULL
                 AND JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')) REGEXP '^[0-9]+$'
               GROUP BY group_key
               HAVING group_key IS NOT NULL
               ORDER BY group_key ASC
               LIMIT 60`,
              [databaseId, table]
            )
          } catch { /* Try next format */ }
        }

        // Approach 4: Just use the raw value as category (fallback)
        if (results.length === 0) {
          try {
            results = await query<GroupedResult>(
              `SELECT 
                SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), 1, 10) as group_key,
                ${aggregationExpr} as result
               FROM synced_data
               WHERE database_id = ? 
                 AND table_name = ?
                 AND JSON_EXTRACT(data, '${xPath}') IS NOT NULL
               GROUP BY group_key
               ORDER BY group_key ASC
               LIMIT 60`,
              [databaseId, table]
            )
          } catch { /* Give up */ }
        }

        chartData = results
          .filter(row => row.group_key !== null)
          .map(row => {
            const dateStr = String(row.group_key)
            let displayDate = dateStr
            try {
              const date = new Date(dateStr)
              if (!isNaN(date.getTime())) {
                displayDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            } catch {
              // Keep original string
            }
            return {
              date: displayDate,
              value: Math.round(parseFloat(String(row.result)) * 100) / 100
            }
          })

      } else {
        // Category-based grouping (not a date column)
        const xPath = `$.${xColumn}`
        const results = await query<GroupedResult>(
          `SELECT 
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), 'Unknown') as group_key,
            ${aggregationExpr} as result
           FROM synced_data
           WHERE database_id = ? AND table_name = ?
           GROUP BY group_key
           ORDER BY result DESC
           LIMIT 20`,
          [databaseId, table]
        )

        chartData = results.map(row => ({
          category: String(row.group_key),
          value: Math.round(parseFloat(String(row.result)) * 100) / 100
        }))
      }

    } else {
      // No x column - just aggregate the entire table
      const results = await query<SingleResult>(
        `SELECT ${aggregationExpr} as result, COUNT(*) as row_count
         FROM synced_data
         WHERE database_id = ? AND table_name = ?`,
        [databaseId, table]
      )

      if (results.length > 0) {
        chartData = [{
          value: Math.round(parseFloat(String(results[0].result)) * 100) / 100
        }]
      }
    }

    // Get total row count for reference (optimized - no JOIN)
    const countResult = await query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt
       FROM synced_data
       WHERE database_id = ? AND table_name = ?`,
      [databaseId, table]
    )

    return NextResponse.json({
      success: true,
      chartId: chart.id,
      data: chartData,
      rowCount: countResult[0]?.cnt || 0,
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
