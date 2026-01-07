import { getSupabaseServerClient } from "@/lib/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()

    // Test 1: Check environment variables
    const envCheck = {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...`
        : "Not set",
    }

    // Test 2: Basic connection test
    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("count")
      .limit(1)

    // Test 3: Check multiple tables
    const tablesToCheck = [
      "teams",
      "chatbots",
      "external_databases",
      "synced_tables",
      "chatbot_database_access",
    ]

    const tableStatus: Record<string, { accessible: boolean; error?: string }> = {}

    for (const table of tablesToCheck) {
      const { error } = await supabase.from(table).select("count").limit(0)
      tableStatus[table] = {
        accessible: !error,
        error: error?.message,
      }
    }

    // Test 4: Simple query
    const { data: sampleData, error: queryError, count } = await supabase
      .from("teams")
      .select("*", { count: "exact" })
      .limit(1)

    return NextResponse.json({
      success: true,
      connection: {
        status: teamsError ? "failed" : "success",
        error: teamsError?.message,
        code: teamsError?.code,
      },
      environment: envCheck,
      tables: tableStatus,
      query: {
        success: !queryError,
        error: queryError?.message,
        count: count || 0,
        sample: sampleData?.[0] || null,
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


