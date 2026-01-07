"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChartGrid } from "./chart-grid"
import { ChatbotPanel } from "./chatbot-panel"
import { DashboardHeader } from "./dashboard-header"
import { Sidebar } from "./sidebar"
import { AddDatabaseDialog } from "./add-database-dialog"
import type { ExternalDatabase, Chatbot } from "@/lib/database"
import { MessageSquare, LayoutDashboard, Database } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DashboardLayoutProps {
  databases: ExternalDatabase[]
  chatbots: Chatbot[]
}

export function DashboardLayout({ databases, chatbots }: DashboardLayoutProps) {
  const router = useRouter()
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(databases[0]?.id || null)
  const [showChatbots, setShowChatbots] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const selectedDatabase = databases.find((db) => db.id === selectedDatabaseId)

  const handleDatabaseAdded = () => {
    // Refresh the page to load new database from server
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        databases={databases}
        selectedDatabaseId={selectedDatabaseId}
        onDatabaseSelect={setSelectedDatabaseId}
        onDatabaseAdded={handleDatabaseAdded}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <DashboardHeader database={selectedDatabase} onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chart Grid */}
          <div className="flex-1 overflow-auto p-6">
            {selectedDatabaseId && databases.length > 0 ? (
              <ChartGrid databaseId={selectedDatabaseId} />
            ) : databases.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <Database className="mx-auto mb-4 w-16 h-16 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Databases Connected</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect external databases to start viewing analytics and insights. Add your first database to get
                    started.
                  </p>
                  <AddDatabaseDialog onDatabaseAdded={handleDatabaseAdded}>
                    <Button variant="default">Add Database</Button>
                  </AddDatabaseDialog>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <LayoutDashboard className="mx-auto mb-4 w-16 h-16 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Database Selected</h3>
                  <p className="text-sm text-muted-foreground">Select a database from the sidebar to view analytics</p>
                </div>
              </div>
            )}
          </div>

          {/* Chatbot Panel */}
          {showChatbots && (
            <div className="w-96 border-l bg-card">
              <ChatbotPanel
                chatbots={chatbots}
                databaseId={selectedDatabaseId}
                onClose={() => setShowChatbots(false)}
              />
            </div>
          )}
        </div>

        {/* Floating Chatbot Button */}
        {!showChatbots && databases.length > 0 && (
          <Button
            size="lg"
            className="fixed right-6 bottom-6 rounded-full shadow-lg w-14 h-14"
            onClick={() => setShowChatbots(true)}
          >
            <MessageSquare className="w-6 h-6" />
          </Button>
        )}
      </div>
    </div>
  )
}
