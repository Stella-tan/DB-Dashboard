import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { connectToExternalDatabase, syncTableData, getTablesToSync } from "@/lib/sync"

export async function POST(req: Request) {
  try {
    const { databaseId } = await req.json()
    
    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 })
    }
    
    const localSupabase = await getSupabaseServerClient()
    
    // Get database connection info
    const { data: database, error: dbError } = await localSupabase
      .from("external_databases")
      .select("*")
      .eq("id", databaseId)
      .single()
    
    if (dbError || !database) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 })
    }
    
    // Get all tables to sync
    const tables = await getTablesToSync(localSupabase, databaseId)
    
    if (tables.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tables registered for syncing",
        results: [],
      })
    }
    
    // Connect to external database
    const externalClient = await connectToExternalDatabase(database.connection_string)
    
    // Sync all tables
    const results = []
    for (const table of tables) {
      const result = await syncTableData(databaseId, table.table_name, externalClient, localSupabase)
      results.push(result)
      
      // Create sync job record
      await localSupabase.from("sync_jobs").insert({
        database_id: databaseId,
        table_name: table.table_name,
        status: result.success ? "completed" : "error",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        rows_synced: result.rowsSynced,
        error_message: result.error || null,
      })
    }
    
    // Update database last_synced_at
    await localSupabase
      .from("external_databases")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", databaseId)
    
    const successCount = results.filter((r) => r.success).length
    const totalRows = results.reduce((sum, r) => sum + r.rowsSynced, 0)
    
    return NextResponse.json({
      success: true,
      message: `Synced ${successCount}/${tables.length} tables. Total rows: ${totalRows}`,
      results,
      summary: {
        totalTables: tables.length,
        successCount,
        failedCount: tables.length - successCount,
        totalRows,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}


