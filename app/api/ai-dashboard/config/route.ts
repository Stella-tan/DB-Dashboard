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
  } catch {
    // Table might already exist - ignore
  }
}

interface AIDashboardConfig {
  id: string
  database_id: string
  config: string
  ai_model: string
  ai_reasoning: string
  generated_at: string
  updated_at: string
}

/**
 * GET - Load existing AI dashboard configuration for a database
 */
export async function GET(req: Request) {
  try {
    // Ensure the config table exists
    await ensureTableExists()
    
    const { searchParams } = new URL(req.url)
    const databaseId = searchParams.get("databaseId")

    if (!databaseId) {
      return NextResponse.json(
        { error: "databaseId is required" },
        { status: 400 }
      )
    }

    const configs = await query<AIDashboardConfig>(
      `SELECT * FROM ai_dashboard_configs WHERE database_id = ?`,
      [databaseId]
    )

    if (configs.length === 0) {
      return NextResponse.json({
        success: true,
        exists: false,
        config: null,
      })
    }

    const savedConfig = configs[0]
    let parsedConfig
    try {
      parsedConfig = typeof savedConfig.config === 'string' 
        ? JSON.parse(savedConfig.config) 
        : savedConfig.config
    } catch {
      parsedConfig = { charts: [], kpis: [] }
    }

    return NextResponse.json({
      success: true,
      exists: true,
      config: parsedConfig,
      aiModel: savedConfig.ai_model,
      aiReasoning: savedConfig.ai_reasoning,
      generatedAt: savedConfig.generated_at,
      updatedAt: savedConfig.updated_at,
    })
  } catch (error: unknown) {
    console.error("Load config error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove AI dashboard configuration (to regenerate)
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const databaseId = searchParams.get("databaseId")

    if (!databaseId) {
      return NextResponse.json(
        { error: "databaseId is required" },
        { status: 400 }
      )
    }

    await query(
      `DELETE FROM ai_dashboard_configs WHERE database_id = ?`,
      [databaseId]
    )

    return NextResponse.json({
      success: true,
      message: "Configuration deleted. Dashboard will regenerate on next load.",
    })
  } catch (error: unknown) {
    console.error("Delete config error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

