import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"

/**
 * API routes for Team Member management
 */

// GET - List available users (for add member dropdown)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const teamId = searchParams.get("teamId")

    const db = await getSupabaseServerClient()

    // Get all users
    const usersResult = await db.from("users").select("*").executeQuery()

    if (usersResult.error) {
      return NextResponse.json({ error: usersResult.error.message }, { status: 500 })
    }

    let availableUsers = usersResult.data || []

    // If teamId is provided, filter out users already in the team
    if (teamId) {
      const membersResult = await db
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
        .executeQuery()

      if (!membersResult.error && membersResult.data) {
        const memberUserIds = new Set(membersResult.data.map((m: any) => m.user_id))
        availableUsers = availableUsers.filter((u: any) => !memberUserIds.has(u.id))
      }
    }

    return NextResponse.json({ success: true, data: availableUsers })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Add member to team
export async function POST(req: Request) {
  try {
    const { teamId, userId, role } = await req.json()

    if (!teamId || !userId) {
      return NextResponse.json(
        { error: "teamId and userId are required" },
        { status: 400 }
      )
    }

    const validRoles = ["admin", "member", "viewer"]
    const memberRole = validRoles.includes(role) ? role : "member"

    const db = await getSupabaseServerClient()

    // Check if user is already a member
    const existingResult = await db
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single()

    if (existingResult.data) {
      return NextResponse.json(
        { error: "User is already a member of this team" },
        { status: 400 }
      )
    }

    const result = await db.insert("team_members", {
      team_id: teamId,
      user_id: userId,
      role: memberRole,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update member role
export async function PUT(req: Request) {
  try {
    const { memberId, role } = await req.json()

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 })
    }

    const validRoles = ["admin", "member", "viewer"]
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be admin, member, or viewer" },
        { status: 400 }
      )
    }

    const db = await getSupabaseServerClient()

    const result = await db.update("team_members", { role }, { id: memberId })

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove member from team
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get("memberId")

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 })
    }

    const db = await getSupabaseServerClient()

    const result = await db.delete("team_members", { id: memberId })

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

