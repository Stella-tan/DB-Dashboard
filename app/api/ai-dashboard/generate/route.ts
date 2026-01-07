import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

// Auto-create the ai_dashboard_configs table if it doesn't exist
async function ensureTableExists() {
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
  } catch (error) {
    // Table might already exist or foreign key issue - ignore
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

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Generate AI-powered chart recommendations based on discovered tables
 */
export async function POST(req: Request) {
  try {
    // Ensure the config table exists
    await ensureTableExists()
    
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

    // Get AI API configuration from environment
    // Priority: AI_API_KEY > OPENAI_API_KEY > OPENROUTER_API_KEY
    let aiApiKey = process.env.AI_API_KEY
    let aiBaseUrl = process.env.AI_BASE_URL
    let aiModel = process.env.AI_MODEL
    
    // Auto-detect which API to use based on available keys
    if (!aiApiKey && process.env.OPENAI_API_KEY) {
      aiApiKey = process.env.OPENAI_API_KEY
      aiBaseUrl = aiBaseUrl || "https://api.openai.com/v1"
      aiModel = aiModel || "gpt-4o-mini"
    } else if (!aiApiKey && process.env.OPENROUTER_API_KEY) {
      aiApiKey = process.env.OPENROUTER_API_KEY
      aiBaseUrl = aiBaseUrl || "https://openrouter.ai/api/v1"
      aiModel = aiModel || "openai/gpt-4o-mini"
    } else {
      // Default to OpenAI if AI_API_KEY is set but no base URL
      aiBaseUrl = aiBaseUrl || "https://api.openai.com/v1"
      aiModel = aiModel || "gpt-4o-mini"
    }

    if (!aiApiKey) {
      return NextResponse.json(
        { error: "AI API key not configured. Please add AI_API_KEY to your .env.local file." },
        { status: 500 }
      )
    }

    // Log AI configuration
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

    // Build the prompt with table information
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
    console.log("📝 User Prompt Preview (first 500 chars):")
    console.log(userPrompt.slice(0, 500) + "...")
    console.log("─".repeat(60))

    // Call AI API
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

    // Parse AI response
    let parsedConfig: AIResponse
    try {
      // Clean the response - remove markdown code blocks if present
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

    // Validate and add UUIDs if missing
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

    // Save to database
    const configJson = JSON.stringify({
      charts: parsedConfig.charts,
      kpis: parsedConfig.kpis,
    })

    // Check if config exists for this database
    const existingConfig = await query<{ id: string }>(
      `SELECT id FROM ai_dashboard_configs WHERE database_id = ?`,
      [databaseId]
    )

    if (existingConfig.length > 0) {
      // Update existing config
      await query(
        `UPDATE ai_dashboard_configs 
         SET config = ?, ai_model = ?, ai_reasoning = ?, updated_at = NOW()
         WHERE database_id = ?`,
        [configJson, aiModel, parsedConfig.reasoning || '', databaseId]
      )
    } else {
      // Insert new config
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
    console.log("═".repeat(60))
    console.log("✅ AI DASHBOARD GENERATION COMPLETE!")
    console.log("═".repeat(60) + "\n")

    return NextResponse.json({
      success: true,
      config: parsedConfig,
      model: aiModel,
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

