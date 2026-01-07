import { Suspense } from "react"
import { getSupabaseServerClient } from "@/lib/server"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"

export default async function DashboardPage() {
  const db = await getSupabaseServerClient()

  // Fetch available databases
  const dbResult = await db.from("external_databases").select("*").order("name").executeQuery()
  const databases = dbResult.data || []

  // Fetch available chatbots
  const chatbotResult = await db.from("chatbots").select("*").order("name").executeQuery()
  const chatbots = chatbotResult.data || []

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardLayout databases={databases || []} chatbots={chatbots || []} />
      </Suspense>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex h-screen">
      <Skeleton className="w-64 h-full" />
      <div className="flex-1 p-6">
        <Skeleton className="h-16 mb-6" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  )
}
