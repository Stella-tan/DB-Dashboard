import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

interface ChartConfig {
  id: string
  title: string
  type: "line" | "bar" | "pie" | "area" | "stat"
  table: string
  columns: {
    x?: string
    y: string
    groupBy?: string
  }
  aggregation: "count" | "sum" | "avg" | "min" | "max"
  dateRange?: string
}

interface KPIConfig {
  id: string
  title: string
  table: string
  column: string
  aggregation: "count" | "sum" | "avg" | "min" | "max"
  icon: string
  compareWith?: string
}

interface DashboardConfig {
  charts: ChartConfig[]
  kpis: KPIConfig[]
}

interface GroupedResult {
  group_key: string
  result: string | number
}

interface SingleResult {
  result: string | number
  row_count: number
}

interface AggregationResult {
  result: string | number | null
  row_count: number
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Compute chart data for a given chart configuration
 */
async function computeChartData(
  databaseId: string, 
  chart: ChartConfig
): Promise<Record<string, unknown>[]> {
  const { table, columns, aggregation, type } = chart
  const xColumn = columns?.x
  const yColumn = columns?.y || 'id'
  const groupBy = columns?.groupBy

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

  try {
    if (type === "pie" || groupBy) {
      const groupColumn = groupBy || xColumn
      if (!groupColumn) return []

      const groupPath = `$.${groupColumn}`
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
      const dateKeywords = ['created_at', 'updated_at', 'date', 'timestamp', 'time', 'created', 'modified']
      const isDateCol = dateKeywords.some(kw => xColumn.toLowerCase().includes(kw))

      if (isDateCol) {
        const xPath = `$.${xColumn}`
        let results: GroupedResult[] = []
        
        try {
          results = await query<GroupedResult>(
            `SELECT 
              DATE(STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), '%Y-%m-%dT%H:%i:%s')) as group_key,
              ${aggregationExpr} as result
             FROM synced_data
             WHERE database_id = ? AND table_name = ?
               AND JSON_EXTRACT(data, '${xPath}') IS NOT NULL
               AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), '%Y-%m-%dT%H:%i:%s') IS NOT NULL
             GROUP BY group_key
             ORDER BY group_key ASC
             LIMIT 60`,
            [databaseId, table]
          )
        } catch { /* ignore */ }

        if (results.length === 0) {
          try {
            results = await query<GroupedResult>(
              `SELECT 
                DATE(STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), '%Y-%m-%d %H:%i:%s')) as group_key,
                ${aggregationExpr} as result
               FROM synced_data
               WHERE database_id = ? AND table_name = ?
                 AND JSON_EXTRACT(data, '${xPath}') IS NOT NULL
                 AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), '%Y-%m-%d %H:%i:%s') IS NOT NULL
               GROUP BY group_key
               ORDER BY group_key ASC
               LIMIT 60`,
              [databaseId, table]
            )
          } catch { /* ignore */ }
        }

        if (results.length === 0) {
          try {
            results = await query<GroupedResult>(
              `SELECT 
                DATE(FROM_UNIXTIME(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')) AS UNSIGNED))) as group_key,
                ${aggregationExpr} as result
               FROM synced_data
               WHERE database_id = ? AND table_name = ?
                 AND JSON_EXTRACT(data, '${xPath}') IS NOT NULL
                 AND JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')) REGEXP '^[0-9]+$'
               GROUP BY group_key
               HAVING group_key IS NOT NULL
               ORDER BY group_key ASC
               LIMIT 60`,
              [databaseId, table]
            )
          } catch { /* ignore */ }
        }

        if (results.length === 0) {
          try {
            results = await query<GroupedResult>(
              `SELECT 
                SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(data, '${xPath}')), 1, 10) as group_key,
                ${aggregationExpr} as result
               FROM synced_data
               WHERE database_id = ? AND table_name = ?
                 AND JSON_EXTRACT(data, '${xPath}') IS NOT NULL
               GROUP BY group_key
               ORDER BY group_key ASC
               LIMIT 60`,
              [databaseId, table]
            )
          } catch { /* ignore */ }
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
            } catch { /* keep original */ }
            return {
              date: displayDate,
              value: Math.round(parseFloat(String(row.result)) * 100) / 100
            }
          })

      } else {
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
  } catch (error) {
    console.error(`Error computing chart ${chart.id}:`, error)
  }

  return chartData
}

/**
 * Compute KPI data for a given KPI configuration
 */
async function computeKPIData(
  databaseId: string, 
  kpi: KPIConfig
): Promise<{ value: number; growth: number }> {
  const { table, column, aggregation } = kpi
  const jsonPath = `$.${column}`
  
  let aggregationSQL: string
  switch (aggregation) {
    case "count":
      aggregationSQL = `COUNT(*) as result`
      break
    case "sum":
      aggregationSQL = `COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))), 0) as result`
      break
    case "avg":
      aggregationSQL = `COALESCE(AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))), 0) as result`
      break
    case "min":
      aggregationSQL = `COALESCE(MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))), 0) as result`
      break
    case "max":
      aggregationSQL = `COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${jsonPath}')) AS DECIMAL(20,2))), 0) as result`
      break
    default:
      aggregationSQL = `COUNT(*) as result`
  }

  try {
    const mainResult = await query<AggregationResult>(
      `SELECT ${aggregationSQL}, COUNT(*) as row_count
       FROM synced_data
       WHERE database_id = ? AND table_name = ?`,
      [databaseId, table]
    )

    if (mainResult.length === 0 || mainResult[0].row_count === 0) {
      return { value: 0, growth: 0 }
    }

    const value = parseFloat(String(mainResult[0].result)) || 0

    let growth = 0
    if (kpi.compareWith === "previous_period" && aggregation === "count") {
      try {
        const recentResult = await query<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM synced_data
           WHERE database_id = ? AND table_name = ? AND synced_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          [databaseId, table]
        )
        const previousResult = await query<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM synced_data
           WHERE database_id = ? AND table_name = ?
             AND synced_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
             AND synced_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          [databaseId, table]
        )
        const recentCount = recentResult[0]?.cnt || 0
        const previousCount = previousResult[0]?.cnt || 0
        if (previousCount > 0) {
          growth = ((recentCount - previousCount) / previousCount) * 100
        }
      } catch { /* ignore */ }
    }

    return { 
      value: Math.round(value * 100) / 100, 
      growth: Math.round(growth * 10) / 10 
    }
  } catch (error) {
    console.error(`Error computing KPI ${kpi.id}:`, error)
    return { value: 0, growth: 0 }
  }
}

/**
 * POST: Refresh dashboard cache for a database using EXISTING config (no AI call)
 * This is called after data sync to update cached values with fresh data
 */
export async function POST(req: Request) {
  try {
    const { databaseId } = await req.json() as { databaseId: string }

    if (!databaseId) {
      return NextResponse.json(
        { error: "databaseId is required" },
        { status: 400 }
      )
    }

    console.log(`\n🔄 Refreshing dashboard cache for database: ${databaseId}`)

    // Get existing config (no AI call!)
    const configResult = await query<{ config: string }>(
      `SELECT config FROM ai_dashboard_configs WHERE database_id = ?`,
      [databaseId]
    )

    if (configResult.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No existing dashboard config found. Please generate with AI first.",
      })
    }

    const config: DashboardConfig = typeof configResult[0].config === 'string'
      ? JSON.parse(configResult[0].config)
      : configResult[0].config

    const charts = config.charts || []
    const kpis = config.kpis || []

    console.log(`   Found ${charts.length} charts and ${kpis.length} KPIs to refresh`)

    // Clear existing cache
    await query(`DELETE FROM ai_dashboard_cache WHERE database_id = ?`, [databaseId])

    // Recompute and cache all charts
    for (const chart of charts) {
      console.log(`   📊 Refreshing chart: ${chart.title}`)
      const data = await computeChartData(databaseId, chart)
      
      await query(
        `INSERT INTO ai_dashboard_cache (id, database_id, item_id, item_type, config, computed_data, computed_at)
         VALUES (?, ?, ?, 'chart', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE config = VALUES(config), computed_data = VALUES(computed_data), computed_at = NOW()`,
        [generateUUID(), databaseId, chart.id, JSON.stringify(chart), JSON.stringify(data)]
      )
    }

    // Recompute and cache all KPIs
    for (const kpi of kpis) {
      console.log(`   📈 Refreshing KPI: ${kpi.title}`)
      const data = await computeKPIData(databaseId, kpi)
      
      await query(
        `INSERT INTO ai_dashboard_cache (id, database_id, item_id, item_type, config, computed_data, computed_at)
         VALUES (?, ?, ?, 'kpi', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE config = VALUES(config), computed_data = VALUES(computed_data), computed_at = NOW()`,
        [generateUUID(), databaseId, kpi.id, JSON.stringify(kpi), JSON.stringify(data)]
      )
    }

    console.log(`   ✅ Cache refreshed successfully!\n`)

    return NextResponse.json({
      success: true,
      chartsRefreshed: charts.length,
      kpisRefreshed: kpis.length,
      message: "Dashboard cache refreshed with latest data",
    })
  } catch (error: unknown) {
    console.error("Cache refresh error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * GET: Check if cache refresh is needed (compare sync time vs cache time)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const databaseId = searchParams.get("databaseId")

    if (!databaseId) {
      return NextResponse.json(
        { error: "databaseId is required" },
        { status: 400 }
      )
    }

    // Get last sync time
    const syncResult = await query<{ last_synced_at: string }>(
      `SELECT last_synced_at FROM external_databases WHERE id = ?`,
      [databaseId]
    )

    // Get last cache time
    const cacheResult = await query<{ computed_at: string }>(
      `SELECT MAX(computed_at) as computed_at FROM ai_dashboard_cache WHERE database_id = ?`,
      [databaseId]
    )

    const lastSynced = syncResult[0]?.last_synced_at ? new Date(syncResult[0].last_synced_at) : null
    const lastCached = cacheResult[0]?.computed_at ? new Date(cacheResult[0].computed_at) : null

    const needsRefresh = lastSynced && (!lastCached || lastSynced > lastCached)

    return NextResponse.json({
      success: true,
      databaseId,
      lastSynced: lastSynced?.toISOString() || null,
      lastCached: lastCached?.toISOString() || null,
      needsRefresh,
    })
  } catch (error: unknown) {
    console.error("Cache status check error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

