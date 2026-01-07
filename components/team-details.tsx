"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Users, UserPlus, Mail, Shield, Pencil, Trash2, X } from "lucide-react"
import type { Team } from "@/lib/database"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

interface TeamDetailsProps {
  team: Team
  onEditTeam: () => void
  onDeleteTeam: () => void
  onAddMember: () => void
  onMemberChanged: () => void
  refreshKey?: number // Used to trigger member list refresh
}

interface TeamMemberWithUser {
  id: string
  role: string
  user: {
    name: string
    email: string
  }
}

export function TeamDetails({
  team,
  onEditTeam,
  onDeleteTeam,
  onAddMember,
  onMemberChanged,
  refreshKey = 0,
}: TeamDetailsProps) {
  const [members, setMembers] = useState<TeamMemberWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    async function loadMembers() {
      setLoading(true)
      try {
        const response = await fetch(`/api/teams/members/list?teamId=${team.id}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Failed to load members")
        }

        setMembers(result.data || [])
      } catch (error: any) {
        console.error("Error loading members:", error)
      } finally {
        setLoading(false)
      }
    }

    loadMembers()
  }, [team.id, refreshKey])

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setUpdatingRole(memberId)

    try {
      const response = await fetch("/api/teams/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: newRole }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update role")
      }

      // Update local state
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      )

      toast({
        title: "Role Updated",
        description: "Member role has been updated",
      })

      onMemberChanged()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return
    }

    setRemovingMember(memberId)

    try {
      const response = await fetch(`/api/teams/members?memberId=${memberId}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to remove member")
      }

      // Update local state
      setMembers((prev) => prev.filter((m) => m.id !== memberId))

      toast({
        title: "Member Removed",
        description: `${memberName} has been removed from the team`,
      })

      onMemberChanged()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setRemovingMember(null)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default"
      case "member":
        return "secondary"
      case "viewer":
        return "outline"
      default:
        return "secondary"
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin"
      case "member":
        return "Member"
      case "viewer":
        return "Viewer"
      default:
        return role
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Information</CardTitle>
              <CardDescription>Basic details about this team</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onEditTeam}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={onDeleteTeam}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Team Name</label>
            <p className="text-2xl font-bold">{team.name}</p>
          </div>
          {team.description && (
            <div>
              <label className="text-sm font-medium">Description</label>
              <p className="text-sm text-muted-foreground">{team.description}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Created</label>
            <p className="text-sm text-muted-foreground">
              {new Date(team.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members
              </CardTitle>
              <CardDescription>{members.length} members</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={onAddMember}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No members in this team
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.user.name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          {member.user.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Role Selector */}
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.id, value)}
                        disabled={updatingRole === member.id}
                      >
                        <SelectTrigger className="w-[120px]">
                          <div className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Remove Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveMember(member.id, member.user.name)}
                        disabled={removingMember === member.id}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
