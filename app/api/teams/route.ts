import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"

/**
 * API routes for Team CRUD operations
 */

// POST - Create new team
export async function POST(req: Request) {
  try {
    const { name, description } = await req.json()

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Team name is required and must be at least 2 characters" },
        { status: 400 }
      )
    }

    const db = await getSupabaseServerClient()

    const result = await db.insert("teams", {
      name: name.trim(),
      description: description?.trim() || null,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update existing team
export async function PUT(req: Request) {
  try {
    const { id, name, description } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 })
    }

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Team name is required and must be at least 2 characters" },
        { status: 400 }
      )
    }

    const db = await getSupabaseServerClient()

    const result = await db.update(
      "teams",
      {
        name: name.trim(),
        description: description?.trim() || null,
      },
      { id }
    )

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete team
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 })
    }

    const db = await getSupabaseServerClient()

    // Delete team (cascades to team_members, team_database_access, team_chatbot_access)
    const result = await db.delete("teams", { id })

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

