import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, description, database_type, connection_string } = body

    // Validate required fields
    if (!name || !database_type || !connection_string) {
      return NextResponse.json(
        { error: "Name, database_type, and connection_string are required" },
        { status: 400 }
      )
    }

    // Validate database type
    const validTypes = ["postgres", "mysql", "mongodb"]
    if (!validTypes.includes(database_type)) {
      return NextResponse.json(
        { error: `Invalid database_type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      )
    }

    const db = await getSupabaseServerClient()
    const dbId = generateUUID()

    // Insert the new database record
    const { data, error } = await db.insert("external_databases", {
      id: dbId,
      name,
      description: description || null,
      connection_string,
      database_type,
      sync_status: "pending",
      sync_schedule: "manual",
      sync_enabled: true,
    })

    if (error) {
      console.error("Failed to insert database:", error)
      return NextResponse.json(
        { error: "Failed to add database" },
        { status: 500 }
      )
    }

    // Grant default team access to the new database
    const defaultTeamId = "11111111-1111-1111-1111-111111111111"
    await db.insert("team_database_access", {
      id: generateUUID(),
      team_id: defaultTeamId,
      database_id: dbId,
    })

    // Grant default chatbot access to the new database
    const defaultChatbotId = "99999999-9999-9999-9999-999999999991"
    await db.insert("chatbot_database_access", {
      id: generateUUID(),
      chatbot_id: defaultChatbotId,
      database_id: dbId,
      access_level: "read",
    })

    return NextResponse.json({
      success: true,
      message: `Database "${name}" added successfully`,
      database: {
        id: dbId,
        name,
        description,
        database_type,
        sync_status: "pending",
      },
    })
  } catch (error: any) {
    console.error("Error adding database:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

