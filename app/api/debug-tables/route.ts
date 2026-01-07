import { getSupabaseServerClient } from "@/lib/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()

    // Get all synced tables with full details
    const { data: syncedTables, error: syncedError } = await supabase
      .from("synced_tables")
      .select("*")
      .order("table_name")

    // Get all external databases
    const { data: databases, error: dbError } = await supabase
      .from("external_databases")
      .select("*")
      .order("name")

    // Get all application tables (known tables)
    const knownTables = [
      "teams",
      "users",
      "team_members",
      "external_databases",
      "team_database_access",
      "synced_tables",
      "chatbots",
      "chatbot_database_access",
      "team_chatbot_access",
      "dashboard_configs",
      "chart_configs",
      "chat_messages",
    ]

    const applicationTables: Array<{
      name: string
      accessible: boolean
      columns?: string[]
      rowCount?: number
      error?: string
    }> = []

    for (const tableName of knownTables) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select("*")
          .limit(1)

        if (error) {
          applicationTables.push({
            name: tableName,
            accessible: false,
            error: error.message,
          })
        } else {
          const columns = data && data.length > 0 ? Object.keys(data[0]) : []
          applicationTables.push({
            name: tableName,
            accessible: true,
            columns,
            rowCount: count || 0,
          })
        }
      } catch (err: any) {
        applicationTables.push({
          name: tableName,
          accessible: false,
          error: err.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      syncedTables: syncedTables || [],
      syncedTablesError: syncedError?.message,
      externalDatabases: databases || [],
      externalDatabasesError: dbError?.message,
      applicationTables,
      summary: {
        totalSyncedTables: syncedTables?.length || 0,
        totalExternalDatabases: databases?.length || 0,
        totalApplicationTables: applicationTables.filter((t) => t.accessible).length,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}


