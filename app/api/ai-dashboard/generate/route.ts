import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

// Auto-create the tables if they don't exist
async function ensureTablesExist() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ai_dashboard_configs (
        id CHAR(36) PRIMARY KEY,
        database_id CHAR(36) NOT NULL UNIQUE,
        config JSON NOT NULL,
        ai_model VARCHAR(255) DEFAULT 'openai/gpt-4o-mini',
        ai_reasoning TEXT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (database_id) REFERENCES external_databases(id) ON DELETE CASCADE
      )
    `)
    
    await query(`
      CREATE TABLE IF NOT EXISTS ai_dashboard_cache (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        database_id CHAR(36) NOT NULL,
        item_id VARCHAR(100) NOT NULL,
        item_type ENUM('chart', 'kpi') NOT NULL,
        config JSON NOT NULL,
        computed_data JSON NOT NULL,
        computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_db_item (database_id, item_id),
        FOREIGN KEY (database_id) REFERENCES external_databases(id) ON DELETE CASCADE
      )
    `)
  } catch (error) {
    console.log("Table check:", error instanceof Error ? error.message : "unknown")
  }
}

interface TableDiscovery {
  tableName: string
  columns: { name: string; type: string }[]
  rowCount: number
  sampleData: Record<string, unknown>[]
}

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

interface AIResponse {
  charts: ChartConfig[]
  kpis: KPIConfig[]
  reasoning: string
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
        
        // Try ISO format with T
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

        // Try ISO format without T
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

        // Try Unix timestamp
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

        // Fallback to raw value
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

    // Simplified growth calculation
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
 * Cache all chart and KPI data for a dashboard
 */
async function cacheAllData(
  databaseId: string,
  charts: ChartConfig[],
  kpis: KPIConfig[]
): Promise<void> {
  console.log("   🔄 Caching all chart and KPI data...")
  
  // Clear existing cache for this database
  await query(`DELETE FROM ai_dashboard_cache WHERE database_id = ?`, [databaseId])
  
  // Cache all charts
  for (const chart of charts) {
    console.log(`      📊 Computing chart: ${chart.title}`)
    const data = await computeChartData(databaseId, chart)
    
    await query(
      `INSERT INTO ai_dashboard_cache (id, database_id, item_id, item_type, config, computed_data, computed_at)
       VALUES (?, ?, ?, 'chart', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE config = VALUES(config), computed_data = VALUES(computed_data), computed_at = NOW()`,
      [generateUUID(), databaseId, chart.id, JSON.stringify(chart), JSON.stringify(data)]
    )
  }
  
  // Cache all KPIs
  for (const kpi of kpis) {
    console.log(`      📈 Computing KPI: ${kpi.title}`)
    const data = await computeKPIData(databaseId, kpi)
    
    await query(
      `INSERT INTO ai_dashboard_cache (id, database_id, item_id, item_type, config, computed_data, computed_at)
       VALUES (?, ?, ?, 'kpi', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE config = VALUES(config), computed_data = VALUES(computed_data), computed_at = NOW()`,
      [generateUUID(), databaseId, kpi.id, JSON.stringify(kpi), JSON.stringify(data)]
    )
  }
  
  console.log("   ✅ All data cached successfully!")
}

/**
 * Generate AI-powered chart recommendations based on discovered tables
 * AND pre-compute all chart/KPI data for instant loading
 */
export async function POST(req: Request) {
  try {
    await ensureTablesExist()
    
    const { databaseId, tables } = await req.json() as { 
      databaseId: string
      tables: TableDiscovery[] 
    }

    if (!databaseId || !tables || tables.length === 0) {
      return NextResponse.json(
        { error: "databaseId and tables are required" },
        { status: 400 }
      )
    }

    // Get AI API configuration
    let aiApiKey = process.env.AI_API_KEY
    let aiBaseUrl = process.env.AI_BASE_URL
    let aiModel = process.env.AI_MODEL
    
    if (!aiApiKey && process.env.OPENAI_API_KEY) {
      aiApiKey = process.env.OPENAI_API_KEY
      aiBaseUrl = aiBaseUrl || "https://api.openai.com/v1"
      aiModel = aiModel || "gpt-4o-mini"
    } else if (!aiApiKey && process.env.OPENROUTER_API_KEY) {
      aiApiKey = process.env.OPENROUTER_API_KEY
      aiBaseUrl = aiBaseUrl || "https://openrouter.ai/api/v1"
      aiModel = aiModel || "openai/gpt-4o-mini"
    } else {
      aiBaseUrl = aiBaseUrl || "https://api.openai.com/v1"
      aiModel = aiModel || "gpt-4o-mini"
    }

    if (!aiApiKey) {
      return NextResponse.json(
        { error: "AI API key not configured. Please add AI_API_KEY to your .env.local file." },
        { status: 500 }
      )
    }

    console.log("\n" + "═".repeat(60))
    console.log("🤖 AI DASHBOARD GENERATION STARTED")
    console.log("═".repeat(60))
    console.log(`📡 API Base URL: ${aiBaseUrl}`)
    console.log(`🧠 Model: ${aiModel}`)
    console.log(`🔑 API Key: ${aiApiKey?.slice(0, 10)}...${aiApiKey?.slice(-4)}`)
    console.log(`📊 Database ID: ${databaseId}`)
    console.log(`📋 Tables to analyze: ${tables.length}`)
    tables.forEach(t => {
      console.log(`   • ${t.tableName} (${t.rowCount} rows, ${t.columns.length} columns)`)
    })
    console.log("─".repeat(60))

    const tableDescriptions = tables.map(t => {
      const columnList = t.columns.map(c => `  - ${c.name} (${c.type})`).join('\n')
      const sampleStr = t.sampleData.length > 0 
        ? `\n  Sample data (${t.sampleData.length} rows):\n  ${JSON.stringify(t.sampleData.slice(0, 3), null, 2).split('\n').join('\n  ')}`
        : ''
      return `Table: ${t.tableName} (${t.rowCount} rows)\nColumns:\n${columnList}${sampleStr}`
    }).join('\n\n')

    const systemPrompt = `You are a data analytics expert. Your task is to analyze database tables and recommend the best charts and KPIs for a dashboard.

You MUST respond with ONLY valid JSON in the exact format specified. No markdown, no explanations outside the JSON.

The JSON format must be:
{
  "charts": [
    {
      "id": "unique-uuid",
      "title": "Chart Title",
      "type": "line" | "bar" | "pie" | "area" | "stat",
      "table": "table_name",
      "columns": {
        "x": "column_for_x_axis_or_category",
        "y": "column_for_y_axis_or_value",
        "groupBy": "optional_column_to_group_by"
      },
      "aggregation": "count" | "sum" | "avg" | "min" | "max",
      "dateRange": "14d"
    }
  ],
  "kpis": [
    {
      "id": "unique-uuid",
      "title": "KPI Title",
      "table": "table_name",
      "column": "column_name",
      "aggregation": "count" | "sum" | "avg",
      "icon": "users" | "dollar-sign" | "package" | "activity" | "trending-up" | "wallet" | "check-circle" | "clock"
    }
  ],
  "reasoning": "Brief explanation of why these charts and KPIs were chosen"
}

Guidelines:
1. Create 4-6 meaningful charts that show trends, distributions, or comparisons
2. Create 3-4 KPIs showing key metrics
3. For time-series data (dates), prefer line or area charts
4. For categorical comparisons, prefer bar charts
5. For proportions/distributions, prefer pie charts
6. Use "stat" type for single value displays
7. Always use actual table and column names from the provided data
8. For date columns, use them as the x-axis with appropriate aggregation
9. Focus on business-relevant metrics based on the data content`

    const userPrompt = `Analyze these database tables and create a dashboard configuration:

${tableDescriptions}

Create appropriate charts and KPIs based on this data. Focus on:
- User/growth metrics if user data exists
- Transaction/financial metrics if transaction/wallet data exists
- Activity/engagement metrics if task/activity data exists
- Any other relevant business metrics

Remember: Respond ONLY with valid JSON, no other text.`

    console.log("📤 SENDING TO AI...")
    console.log("─".repeat(60))

    const aiResponse = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${aiApiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "DB Dashboard AI"
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error("❌ AI API error:", errorText)
      return NextResponse.json(
        { error: `AI API error: ${aiResponse.status}` },
        { status: 500 }
      )
    }

    console.log("✅ AI Response received!")
    
    const aiResult = await aiResponse.json()
    const aiContent = aiResult.choices?.[0]?.message?.content

    if (!aiContent) {
      console.error("❌ No content in AI response")
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      )
    }

    console.log("─".repeat(60))
    console.log("🤖 AI RAW RESPONSE:")
    console.log("─".repeat(60))
    console.log(aiContent)
    console.log("─".repeat(60))

    let parsedConfig: AIResponse
    try {
      let cleanContent = aiContent.trim()
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7)
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3)
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3)
      }
      cleanContent = cleanContent.trim()
      
      parsedConfig = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent)
      return NextResponse.json(
        { error: "Failed to parse AI response", rawResponse: aiContent },
        { status: 500 }
      )
    }

    if (!parsedConfig.charts) parsedConfig.charts = []
    if (!parsedConfig.kpis) parsedConfig.kpis = []

    parsedConfig.charts = parsedConfig.charts.map(chart => ({
      ...chart,
      id: chart.id || generateUUID(),
    }))

    parsedConfig.kpis = parsedConfig.kpis.map(kpi => ({
      ...kpi,
      id: kpi.id || generateUUID(),
    }))

    // Save config to database
    const configJson = JSON.stringify({
      charts: parsedConfig.charts,
      kpis: parsedConfig.kpis,
    })

    const existingConfig = await query<{ id: string }>(
      `SELECT id FROM ai_dashboard_configs WHERE database_id = ?`,
      [databaseId]
    )

    if (existingConfig.length > 0) {
      await query(
        `UPDATE ai_dashboard_configs 
         SET config = ?, ai_model = ?, ai_reasoning = ?, updated_at = NOW()
         WHERE database_id = ?`,
        [configJson, aiModel, parsedConfig.reasoning || '', databaseId]
      )
    } else {
      await query(
        `INSERT INTO ai_dashboard_configs (id, database_id, config, ai_model, ai_reasoning)
         VALUES (?, ?, ?, ?, ?)`,
        [generateUUID(), databaseId, configJson, aiModel, parsedConfig.reasoning || '']
      )
    }

    console.log("─".repeat(60))
    console.log("📊 GENERATED DASHBOARD CONFIG:")
    console.log(`   KPIs: ${parsedConfig.kpis.length}`)
    parsedConfig.kpis.forEach(kpi => {
      console.log(`      • ${kpi.title} (${kpi.table}.${kpi.column}, ${kpi.aggregation})`)
    })
    console.log(`   Charts: ${parsedConfig.charts.length}`)
    parsedConfig.charts.forEach(chart => {
      console.log(`      • ${chart.title} [${chart.type}] (${chart.table}, ${chart.aggregation})`)
    })
    console.log("─".repeat(60))
    console.log("💡 AI REASONING:")
    console.log(parsedConfig.reasoning || "No reasoning provided")
    console.log("─".repeat(60))

    // ⚡ PRE-COMPUTE AND CACHE ALL DATA
    console.log("⚡ PRE-COMPUTING CHART AND KPI DATA...")
    await cacheAllData(databaseId, parsedConfig.charts, parsedConfig.kpis)

    console.log("═".repeat(60))
    console.log("✅ AI DASHBOARD GENERATION COMPLETE!")
    console.log("   Dashboard will now load instantly from cache.")
    console.log("═".repeat(60) + "\n")

    return NextResponse.json({
      success: true,
      config: parsedConfig,
      model: aiModel,
      cached: true,
    })
  } catch (error: unknown) {
    console.error("AI generation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
