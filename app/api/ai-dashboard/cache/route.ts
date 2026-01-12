import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

interface CacheItem {
  id: string
  database_id: string
  item_id: string
  item_type: 'chart' | 'kpi'
  config: string  // JSON string
  computed_data: string  // JSON string
  computed_at: string
}

/**
 * GET: Load all cached dashboard data for a database
 * This provides instant dashboard loading by reading pre-computed data
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

    // Get all cached items for this database (excluding custom charts)
    const cachedItems = await query<CacheItem>(
      `SELECT id, database_id, item_id, item_type, config, computed_data, computed_at
      FROM ai_dashboard_cache
      WHERE database_id = ?
        AND item_id NOT LIKE 'custom_%'
      ORDER BY item_type DESC, computed_at ASC`,
      [databaseId]
    )

    if (cachedItems.length === 0) {
      return NextResponse.json({
        success: false,
        cached: false,
        message: "No cached data found. Please generate the dashboard first.",
      })
    }

    // Parse and organize the cached data
    const charts: Array<{
      id: string
      config: Record<string, unknown>
      data: Record<string, unknown>[]
    }> = []
    
    const kpis: Array<{
      id: string
      config: Record<string, unknown>
      data: { value: number; growth: number }
    }> = []

    let computedAt: string | null = null

    for (const item of cachedItems) {
      const config = typeof item.config === 'string' ? JSON.parse(item.config) : item.config
      const computedData = typeof item.computed_data === 'string' ? JSON.parse(item.computed_data) : item.computed_data
      
      if (!computedAt) {
        computedAt = item.computed_at
      }

      if (item.item_type === 'chart') {
        charts.push({
          id: item.item_id,
          config,
          data: computedData,
        })
      } else if (item.item_type === 'kpi') {
        kpis.push({
          id: item.item_id,
          config,
          data: computedData,
        })
      }
    }

    return NextResponse.json({
      success: true,
      cached: true,
      computedAt,
      charts,
      kpis,
    })
  } catch (error: unknown) {
    console.error("Cache read error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Clear cached data for a database
 * Call this before regenerating the dashboard
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
      `DELETE FROM ai_dashboard_cache WHERE database_id = ?`,
      [databaseId]
    )

    return NextResponse.json({
      success: true,
      message: "Cache cleared successfully",
    })
  } catch (error: unknown) {
    console.error("Cache delete error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

