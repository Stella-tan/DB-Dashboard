import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const databaseId = searchParams.get("databaseId")

    const supabase = await getSupabaseServerClient()

    if (databaseId) {
      // Get status for specific database
      const { data: database, error: dbError } = await supabase
        .from("external_databases")
        .select("*")
        .eq("id", databaseId)
        .single()

      if (dbError || !database) {
        return NextResponse.json({ error: "Database not found" }, { status: 404 })
      }

      // Get recent sync jobs
      const { data: syncJobs, error: jobsError } = await supabase
        .from("sync_jobs")
        .select("*")
        .eq("database_id", databaseId)
        .order("created_at", { ascending: false })
        .limit(10)

      // Get synced tables
      const { data: syncedTables, error: tablesError } = await supabase
        .from("synced_tables")
        .select("*")
        .eq("database_id", databaseId)

      return NextResponse.json({
        success: true,
        database,
        syncJobs: syncJobs || [],
        syncedTables: syncedTables || [],
      })
    } else {
      // Get all databases status
      const { data: databases, error: dbError } = await supabase
        .from("external_databases")
        .select("*")
        .order("name")

      return NextResponse.json({
        success: true,
        databases: databases || [],
      })
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}


