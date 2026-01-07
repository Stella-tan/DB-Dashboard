import { NextResponse } from "next/server"
import { query } from "@/lib/mysql"

/**
 * GET - List team members with user details (for display in team details)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const teamId = searchParams.get("teamId")

    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required" },
        { status: 400 }
      )
    }

    // Join team_members with users to get member details
    const sql = `
      SELECT 
        tm.id,
        tm.role,
        u.name as user_name,
        u.email as user_email
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.created_at DESC
    `

    const rows = await query<{
      id: string
      role: string
      user_name: string
      user_email: string
    }>(sql, [teamId])

    // Format response to match expected structure
    const members = rows.map((row) => ({
      id: row.id,
      role: row.role,
      user: {
        name: row.user_name,
        email: row.user_email,
      },
    }))

    return NextResponse.json({ success: true, data: members })
  } catch (error: any) {
    console.error("Error loading team members:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

