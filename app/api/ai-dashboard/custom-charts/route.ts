import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

interface CustomChartConfig {
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

interface CacheItem {
  id: string
  database_id: string
  item_id: string
  item_type: 'chart' | 'kpi'
  config: string
  computed_data: string
  computed_at: string
}

interface GroupedResult {
  group_key: string
  result: string | number
}

interface AggregationResult {
  result: string | number | null
  row_count: number
}

/**
 * Build WHERE clause conditions from filters
 */
function buildFilterConditions(filters: CustomChartConfig['filters']): { conditions: string; params: any[] } {
  if (!filters || filters.length === 0) {
    return { conditions: '', params: [] }
  }

  const conditions: string[] = []
  const params: any[] = []

  filters.forEach((filter) => {
    if (!filter.field || !filter.operator || filter.value === undefined || filter.value === '') {
      return // Skip invalid filters
    }

    const fieldPath = `JSON_EXTRACT(data, '$.${filter.field}')`
    const fieldValue = `JSON_UNQUOTE(${fieldPath})`

    // Ensure field exists and is not null
    const fieldExists = `${fieldPath} IS NOT NULL`

    switch (filter.operator) {
      case 'eq':
        // Try string match first, fallback to numeric if value is numeric
        const isNumeric = !isNaN(Number(filter.value)) && filter.value.trim() !== ''
        if (isNumeric) {
          conditions.push(`(${fieldExists} AND (${fieldValue} = ? OR CAST(${fieldValue} AS DECIMAL(20,2)) = ?))`)
          params.push(filter.value, filter.value)
        } else {
          conditions.push(`(${fieldExists} AND ${fieldValue} = ?)`)
          params.push(filter.value)
        }
        break
      case 'neq':
        const isNumericNeq = !isNaN(Number(filter.value)) && filter.value.trim() !== ''
        if (isNumericNeq) {
          conditions.push(`(${fieldExists} AND (${fieldValue} != ? OR CAST(${fieldValue} AS DECIMAL(20,2)) != ?))`)
          params.push(filter.value, filter.value)
        } else {
          conditions.push(`(${fieldExists} AND ${fieldValue} != ?)`)
          params.push(filter.value)
        }
        break
      case 'gt':
        conditions.push(`(${fieldExists} AND CAST(${fieldValue} AS DECIMAL(20,2)) > ?)`)
        params.push(filter.value)
        break
      case 'gte':
        conditions.push(`(${fieldExists} AND CAST(${fieldValue} AS DECIMAL(20,2)) >= ?)`)
        params.push(filter.value)
        break
      case 'lt':
        conditions.push(`(${fieldExists} AND CAST(${fieldValue} AS DECIMAL(20,2)) < ?)`)
        params.push(filter.value)
        break
      case 'lte':
        conditions.push(`(${fieldExists} AND CAST(${fieldValue} AS DECIMAL(20,2)) <= ?)`)
        params.push(filter.value)
        break
      case 'contains':
        conditions.push(`(${fieldExists} AND ${fieldValue} LIKE ?)`)
        params.push(`%${filter.value}%`)
        break
      case 'startsWith':
        conditions.push(`(${fieldExists} AND ${fieldValue} LIKE ?)`)
        params.push(`${filter.value}%`)
        break
      default:
        // Default to equals
        const isNumericDefault = !isNaN(Number(filter.value)) && filter.value.trim() !== ''
        if (isNumericDefault) {
          conditions.push(`(${fieldExists} AND (${fieldValue} = ? OR CAST(${fieldValue} AS DECIMAL(20,2)) = ?))`)
          params.push(filter.value, filter.value)
        } else {
          conditions.push(`(${fieldExists} AND ${fieldValue} = ?)`)
          params.push(filter.value)
        }
    }
  })

  return {
    conditions: conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '',
    params
  }
}

/**
 * Compute chart data from synced_data table
 */
async function computeChartData(
    databaseId: string,
    config: CustomChartConfig
  ): Promise<Array<Record<string, unknown>>> {
    const { dataSource, aggregation, groupBy, filters } = config
    const { table, xAxis, yAxis } = dataSource
  
    if (!table || !xAxis || yAxis.length === 0) {
      return []
    }
  
    try {
      const groupByColumn = groupBy || xAxis
  
      // Build aggregation for EACH yAxis column
      const aggregations = yAxis.map((yColumn, index) => {
        if (aggregation === 'count') {
          return `COUNT(*) as result_${index}`
        }
        const aggFunc = aggregation.toUpperCase()
        return `${aggFunc}(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.${yColumn}')) AS DECIMAL(20,2))) as result_${index}`
      }).join(',\n        ')
  
      // Build filter conditions
      const { conditions: filterConditions, params: filterParams } = buildFilterConditions(filters)
  
      const results = await query<{ group_key: string; [key: string]: string | number }>(`
        SELECT 
          JSON_UNQUOTE(JSON_EXTRACT(data, '$.${groupByColumn}')) as group_key,
          ${aggregations}
        FROM synced_data
        WHERE database_id = ?
          AND table_name = ?
          AND JSON_EXTRACT(data, '$.${groupByColumn}') IS NOT NULL
          ${filterConditions}
        GROUP BY JSON_UNQUOTE(JSON_EXTRACT(data, '$.${groupByColumn}'))
        ORDER BY group_key
        LIMIT 100
      `, [databaseId, table, ...filterParams])
  
      // Transform to chart-friendly format with ALL yAxis values
      return results.map(row => {
        const mapped: Record<string, unknown> = {
          [xAxis]: row.group_key
        }
        
        // Add all yAxis values
        yAxis.forEach((yColumn, index) => {
          mapped[yColumn] = Number(row[`result_${index}`]) || 0
        })
        
        return mapped
      })
    } catch (error) {
      console.error("Error computing chart data:", error)
      
      // Fallback: just get raw data with filters applied
      const { conditions: filterConditions, params: filterParams } = buildFilterConditions(filters)
      
      const rawData = await query<{ data: string }>(`
        SELECT data FROM synced_data
        WHERE database_id = ? AND table_name = ?
          ${filterConditions}
        LIMIT 100
      `, [databaseId, table, ...filterParams])
  
      return rawData.map(row => {
        const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
        const mapped: Record<string, unknown> = {
          [xAxis]: parsed[xAxis]
        }
        
        yAxis.forEach(yColumn => {
          mapped[yColumn] = Number(parsed[yColumn]) || 0
        })
        
        return mapped
      }).slice(0, 100)
    }
  }

/**
 * GET: Load all custom charts for a database
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

    // Get all custom charts (item_id starts with "custom_")
    const customCharts = await query<CacheItem>(
      `SELECT id, database_id, item_id, item_type, config, computed_data, computed_at
       FROM ai_dashboard_cache
       WHERE database_id = ? AND item_id LIKE 'custom_%'
       ORDER BY created_at DESC`,
      [databaseId]
    )

    const charts = customCharts.map(item => ({
      id: item.item_id,
      config: typeof item.config === 'string' ? JSON.parse(item.config) : item.config,
      data: typeof item.computed_data === 'string' ? JSON.parse(item.computed_data) : item.computed_data,
      computedAt: item.computed_at
    }))

    return NextResponse.json({
      success: true,
      charts
    })
  } catch (error: unknown) {
    console.error("Load custom charts error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * POST: Save a new custom chart
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { databaseId, config } = body as { databaseId: string; config: CustomChartConfig }

    if (!databaseId) {
      return NextResponse.json(
        { error: "databaseId is required" },
        { status: 400 }
      )
    }

    if (!config || !config.title || !config.dataSource?.table) {
      return NextResponse.json(
        { error: "Invalid chart configuration" },
        { status: 400 }
      )
    }

    // Generate unique ID for this custom chart
    const chartId = `custom_${generateUUID()}`
    const cacheId = generateUUID()

    // Compute the chart data
    const computedData = await computeChartData(databaseId, config)

    // Save to ai_dashboard_cache
    await query(
      `INSERT INTO ai_dashboard_cache 
       (id, database_id, item_id, item_type, config, computed_data, computed_at)
       VALUES (?, ?, ?, 'chart', ?, ?, NOW())`,
      [
        cacheId,
        databaseId,
        chartId,
        JSON.stringify(config),
        JSON.stringify(computedData)
      ]
    )

    return NextResponse.json({
      success: true,
      chartId,
      message: "Custom chart saved successfully",
      data: computedData
    })
  } catch (error: unknown) {
    console.error("Save custom chart error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Delete a custom chart
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const databaseId = searchParams.get("databaseId")
    const chartId = searchParams.get("chartId")

    if (!databaseId || !chartId) {
      return NextResponse.json(
        { error: "databaseId and chartId are required" },
        { status: 400 }
      )
    }

    // Only allow deleting custom charts
    if (!chartId.startsWith("custom_")) {
      return NextResponse.json(
        { error: "Can only delete custom charts" },
        { status: 400 }
      )
    }

    await query(
      `DELETE FROM ai_dashboard_cache 
       WHERE database_id = ? AND item_id = ?`,
      [databaseId, chartId]
    )

    return NextResponse.json({
      success: true,
      message: "Custom chart deleted successfully"
    })
  } catch (error: unknown) {
    console.error("Delete custom chart error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Refresh/recompute a custom chart's data
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { databaseId, chartId } = body as { databaseId: string; chartId: string }

    if (!databaseId || !chartId) {
      return NextResponse.json(
        { error: "databaseId and chartId are required" },
        { status: 400 }
      )
    }

    // Get the chart config
    const charts = await query<CacheItem>(
      `SELECT * FROM ai_dashboard_cache WHERE database_id = ? AND item_id = ?`,
      [databaseId, chartId]
    )

    if (charts.length === 0) {
      return NextResponse.json(
        { error: "Chart not found" },
        { status: 404 }
      )
    }

    const chart = charts[0]
    const config = typeof chart.config === 'string' ? JSON.parse(chart.config) : chart.config

    // Recompute the data
    const computedData = await computeChartData(databaseId, config)

    // Update the cache
    await query(
      `UPDATE ai_dashboard_cache 
       SET computed_data = ?, computed_at = NOW()
       WHERE database_id = ? AND item_id = ?`,
      [JSON.stringify(computedData), databaseId, chartId]
    )

    return NextResponse.json({
      success: true,
      message: "Chart data refreshed",
      data: computedData
    })
  } catch (error: unknown) {
    console.error("Refresh custom chart error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

