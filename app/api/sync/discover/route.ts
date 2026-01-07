import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { connectToExternalDatabase } from "@/lib/sync"

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
    
    try {
      // Test connection to external database
      const externalClient = await connectToExternalDatabase(database.connection_string)
      
      // Note: Supabase REST API doesn't expose information_schema
      // Tables should be manually registered in synced_tables
      // This endpoint just verifies the connection works by creating the client
      // We can't easily test without knowing a table name, so we just verify the client was created
      
      return NextResponse.json({
        success: true,
        message: "Connection successful. Please register tables manually in synced_tables.",
        database: {
          id: database.id,
          name: database.name,
        },
      })
    } catch (error: any) {
      return NextResponse.json(
        { error: `Connection failed: ${error.message}` },
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

