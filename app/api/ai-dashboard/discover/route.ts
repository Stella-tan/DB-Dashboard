import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

interface SyncedTable {
  id: string
  table_name: string
  schema_definition: string
  row_count: number
}

interface SyncedDataRow {
  data: string
}

interface TableDiscovery {
  tableName: string
  columns: { name: string; type: string }[]
  rowCount: number
  sampleData: Record<string, unknown>[]
}

/**
 * Discover all tables, columns, and sample data for a given database
 * This is used to provide context to the AI for chart recommendations
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

    // Get all synced tables for this database
    const syncedTables = await query<SyncedTable>(
      `SELECT id, table_name, schema_definition, row_count 
       FROM synced_tables 
       WHERE database_id = ?
       ORDER BY table_name`,
      [databaseId]
    )

    if (syncedTables.length === 0) {
      return NextResponse.json({
        success: true,
        tables: [],
        message: "No synced tables found. Please sync the database first.",
      })
    }

    const tables: TableDiscovery[] = []

    for (const table of syncedTables) {
      // Parse schema definition
      let columns: { name: string; type: string }[] = []
      try {
        const schema = typeof table.schema_definition === 'string' 
          ? JSON.parse(table.schema_definition) 
          : table.schema_definition
        columns = schema.columns || []
      } catch {
        columns = []
      }

      // Get 5 random sample rows from synced_data
      const sampleRows = await query<SyncedDataRow>(
        `SELECT data FROM synced_data 
         WHERE synced_table_id = ? 
         ORDER BY RAND() 
         LIMIT 5`,
        [table.id]
      )

      const sampleData: Record<string, unknown>[] = sampleRows.map(row => {
        try {
          return typeof row.data === 'string' ? JSON.parse(row.data) : row.data
        } catch {
          return {}
        }
      })

      // If we have sample data but no columns defined, infer from data
      if (columns.length === 0 && sampleData.length > 0) {
        columns = Object.keys(sampleData[0]).map(key => ({
          name: key,
          type: typeof sampleData[0][key]
        }))
      }

      tables.push({
        tableName: table.table_name,
        columns,
        rowCount: table.row_count,
        sampleData,
      })
    }

    return NextResponse.json({
      success: true,
      databaseId,
      tableCount: tables.length,
      tables,
    })
  } catch (error: unknown) {
    console.error("Discover tables error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

