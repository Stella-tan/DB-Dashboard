import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { connectToExternalDatabase, syncTableData } from "@/lib/sync"

export async function POST(req: Request) {
  try {
    const { databaseId, tableName } = await req.json()
    
    if (!databaseId || !tableName) {
      return NextResponse.json(
        { error: "databaseId and tableName are required" },
        { status: 400 }
      )
    }
    
    const localDb = await getSupabaseServerClient()
    
    // Get database connection info
    const dbResult = await localDb
      .from("external_databases")
      .select("*")
      .eq("id", databaseId)
      .single()
    
    if (dbResult.error || !dbResult.data) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 })
    }
    
    const database = dbResult.data
    
    // Check if table is registered
    const tableResult = await localDb
      .from("synced_tables")
      .select("id")
      .eq("database_id", databaseId)
      .eq("table_name", tableName)
      .single()
    
    if (tableResult.error || !tableResult.data) {
      return NextResponse.json(
        { error: `Table ${tableName} is not registered. Please add it to synced_tables first.` },
        { status: 404 }
      )
    }
    
    // Create sync job
    const jobResult = await localDb.insert("sync_jobs", {
      database_id: databaseId,
      table_name: tableName,
      status: "running",
      started_at: new Date().toISOString(),
    })
    
    if (jobResult.error || !jobResult.data || jobResult.data.length === 0) {
      return NextResponse.json({ error: jobResult.error?.message || "Failed to create sync job" }, { status: 500 })
    }
    
    const syncJob = jobResult.data[0]
    
    try {
      // Connect to external database
      const externalClient = await connectToExternalDatabase(database.connection_string)
      
      // Sync table data
      const result = await syncTableData(databaseId, tableName, externalClient, localDb)
      
      // Update sync job
      await localDb.update(
        "sync_jobs",
        {
          status: result.success ? "completed" : "error",
          completed_at: new Date().toISOString(),
          rows_synced: result.rowsSynced,
          error_message: result.error || null,
        },
        { id: syncJob.id }
      )
      
      // Update database last_synced_at
      await localDb.update(
        "external_databases",
        { last_synced_at: new Date().toISOString() },
        { id: databaseId }
      )
      
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error,
            rowsSynced: result.rowsSynced,
            jobId: syncJob.id,
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        rowsSynced: result.rowsSynced,
        jobId: syncJob.id,
        message: `Successfully synced ${result.rowsSynced} rows from ${tableName}`,
      })
    } catch (error: any) {
      // Update sync job with error
      await localDb.update(
        "sync_jobs",
        {
          status: "error",
          completed_at: new Date().toISOString(),
          error_message: error.message,
        },
        { id: syncJob.id }
      )
      
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

