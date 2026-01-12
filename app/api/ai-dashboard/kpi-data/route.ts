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

interface AggregationResult {
  result: string | number | null
  row_count: number
}

/**
 * Fetch KPI data using MySQL aggregation for better performance
 * OPTIMIZED: Uses denormalized database_id/table_name columns to avoid JOINs
 * With simplified growth calculation to avoid slow queries
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

    const { table, column, aggregation } = kpi

    // Build the aggregation SQL based on the aggregation type
    const jsonPath = `$.${column}`
    let aggregationSQL: string

    switch (aggregation) {
      case "count":
        aggregationSQL = `COUNT(*) as result`
        break
      case "sum":
        aggregationSQL = `COALESCE(SUM(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))
        ), 0) as result`
        break
      case "avg":
        aggregationSQL = `COALESCE(AVG(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))
        ), 0) as result`
        break
      case "min":
        aggregationSQL = `COALESCE(MIN(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))
        ), 0) as result`
        break
      case "max":
        aggregationSQL = `COALESCE(MAX(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))
        ), 0) as result`
        break
      default:
        aggregationSQL = `COUNT(*) as result`
    }

    // OPTIMIZED: Query directly on synced_data using denormalized columns - no JOIN!
    const mainResult = await query<AggregationResult>(
      `SELECT ${aggregationSQL}, COUNT(*) as row_count
       FROM synced_data
       WHERE database_id = ? AND table_name = ?`,
      [databaseId, table]
    )

    if (mainResult.length === 0 || mainResult[0].row_count === 0) {
      return NextResponse.json({
        success: true,
        kpiId: kpi.id,
        value: 0,
        growth: 0,
        message: "No data available",
      })
    }

    const value = parseFloat(String(mainResult[0].result)) || 0
    const rowCount = mainResult[0].row_count

    // Simplified growth calculation - skip if data is small or no compareWith
    // Growth calculation can be expensive, so we'll only do it for count aggregation
    // and use synced_at instead of trying to parse JSON dates
    let growth = 0
    if (kpi.compareWith === "previous_period" && aggregation === "count") {
      try {
        // OPTIMIZED: No JOIN needed - use denormalized columns with composite index
        const recentResult = await query<{ cnt: number }>(
          `SELECT COUNT(*) as cnt
           FROM synced_data
           WHERE database_id = ? 
             AND table_name = ?
             AND synced_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          [databaseId, table]
        )

        const previousResult = await query<{ cnt: number }>(
          `SELECT COUNT(*) as cnt
           FROM synced_data
           WHERE database_id = ? 
             AND table_name = ?
             AND synced_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
             AND synced_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          [databaseId, table]
        )

        const recentCount = recentResult[0]?.cnt || 0
        const previousCount = previousResult[0]?.cnt || 0

        if (previousCount > 0) {
          growth = ((recentCount - previousCount) / previousCount) * 100
        }
      } catch {
        // Growth calculation failed, keep growth = 0
      }
    }

    return NextResponse.json({
      success: true,
      kpiId: kpi.id,
      value: Math.round(value * 100) / 100,
      growth: Math.round(growth * 10) / 10,
      rowCount,
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
