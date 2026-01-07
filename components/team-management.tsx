"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Users, Database, Bot, Plus, ArrowLeft } from "lucide-react"
import type { Team, ExternalDatabase, Chatbot } from "@/lib/database"
import { TeamList } from "./team-list"
import { TeamDetails } from "./team-details"
import { DatabaseAccessManager } from "./database-access-manager"
import { ChatbotAccessManager } from "./chatbot-access-manager"
import { TeamDialog } from "./team-dialog"
import { DeleteTeamDialog } from "./delete-team-dialog"
import { AddMemberDialog } from "./add-member-dialog"
import Link from "next/link"

interface TeamManagementProps {
  teams: Team[]
  databases: ExternalDatabase[]
  chatbots: Chatbot[]
}

export function TeamManagement({ teams, databases, chatbots }: TeamManagementProps) {
  const router = useRouter()
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)

  // Key to trigger member list refresh
  const [memberRefreshKey, setMemberRefreshKey] = useState(0)

  // Sync selectedTeam with updated teams data after refresh
  useEffect(() => {
    if (selectedTeam) {
      const updatedTeam = teams.find((t) => t.id === selectedTeam.id)
      if (updatedTeam) {
        // Update selectedTeam with fresh data from server
        setSelectedTeam(updatedTeam)
      } else {
        // Team was deleted, clear selection
        setSelectedTeam(null)
      }
    }
  }, [teams])

  // Refresh page data after mutations
  const refreshData = () => {
    router.refresh()
  }

  // Refresh member list (for add/remove member operations)
  const refreshMembers = () => {
    setMemberRefreshKey((prev) => prev + 1)
    router.refresh()
  }

  // Handle team deletion - also clear selection
  const handleTeamDeleted = () => {
    setSelectedTeam(null)
    refreshData()
  }

  // Handle edit team
  const handleEditTeam = () => {
    setEditDialogOpen(true)
  }

  // Handle delete team
  const handleDeleteTeam = () => {
    setDeleteDialogOpen(true)
  }

  // Handle add member
  const handleAddMember = () => {
    setAddMemberDialogOpen(true)
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-3xl">Team Management</h1>
          <p className="text-muted-foreground">Manage teams, permissions, and access control</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Teams
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription>{teams.length} teams</CardDescription>
          </CardHeader>
          <CardContent>
            <TeamList teams={teams} selectedTeam={selectedTeam} onSelectTeam={setSelectedTeam} />
          </CardContent>
        </Card>

        {/* Team Details and Permissions */}
        <div className="lg:col-span-2">
          {selectedTeam ? (
            <Tabs defaultValue="details" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="databases">Databases</TabsTrigger>
                <TabsTrigger value="chatbots">Chatbots</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <TeamDetails
                  team={selectedTeam}
                  onEditTeam={handleEditTeam}
                  onDeleteTeam={handleDeleteTeam}
                  onAddMember={handleAddMember}
                  onMemberChanged={refreshMembers}
                  refreshKey={memberRefreshKey}
                />
              </TabsContent>

              <TabsContent value="databases">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      Database Access
                    </CardTitle>
                    <CardDescription>Manage which databases this team can access</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DatabaseAccessManager teamId={selectedTeam.id} databases={databases} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="chatbots">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="w-5 h-5" />
                      Chatbot Access
                    </CardTitle>
                    <CardDescription>Manage which AI assistants this team can use</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChatbotAccessManager teamId={selectedTeam.id} chatbots={chatbots} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <Users className="mx-auto w-12 h-12 mb-4 text-muted-foreground" />
                <h3 className="font-semibold text-lg mb-2">No Team Selected</h3>
                <p className="text-sm text-muted-foreground">Select a team from the list to manage permissions</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <TeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refreshData}
      />

      <TeamDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        team={selectedTeam}
        onSuccess={refreshData}
      />

      <DeleteTeamDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        team={selectedTeam}
        onSuccess={handleTeamDeleted}
      />

      <AddMemberDialog
        open={addMemberDialogOpen}
        onOpenChange={setAddMemberDialogOpen}
        team={selectedTeam}
        onSuccess={refreshMembers}
      />
    </div>
  )
}
