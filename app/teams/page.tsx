import { getSupabaseServerClient } from "@/lib/server"
import { TeamManagement } from "@/components/team-management"

export default async function TeamsPage() {
  const db = await getSupabaseServerClient()

  // Fetch teams, databases, and chatbots
  const [teamsResult, databasesResult, chatbotsResult] = await Promise.all([
    db.from("teams").select("*").order("name").executeQuery(),
    db.from("external_databases").select("*").order("name").executeQuery(),
    db.from("chatbots").select("*").order("name").executeQuery(),
  ])
  
  const teams = teamsResult.data || []
  const databases = databasesResult.data || []
  const chatbots = chatbotsResult.data || []

  return (
    <div className="min-h-screen bg-background">
      <TeamManagement teams={teams || []} databases={databases || []} chatbots={chatbots || []} />
    </div>
  )
}
