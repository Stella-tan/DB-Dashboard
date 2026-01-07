"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { Team, User } from "@/lib/database"

interface AddMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: Team | null
  onSuccess: () => void
}

export function AddMemberDialog({
  open,
  onOpenChange,
  team,
  onSuccess,
}: AddMemberDialogProps) {
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [selectedRole, setSelectedRole] = useState<string>("member")
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const { toast } = useToast()

  // Load available users when dialog opens
  useEffect(() => {
    if (open && team) {
      loadAvailableUsers()
    }
  }, [open, team])

  const loadAvailableUsers = async () => {
    if (!team) return

    setLoadingUsers(true)
    try {
      const response = await fetch(`/api/teams/members?teamId=${team.id}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to load users")
      }

      setAvailableUsers(result.data || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!team || !selectedUserId) {
      toast({
        title: "Validation Error",
        description: "Please select a user",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/teams/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          userId: selectedUserId,
          role: selectedRole,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to add member")
      }

      toast({
        title: "Member Added",
        description: "New member has been added to the team",
      })

      // Reset form
      setSelectedUserId("")
      setSelectedRole("member")
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedUserId("")
      setSelectedRole("member")
    }
    onOpenChange(open)
  }

  if (!team) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to team "{team.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="user">Select User *</Label>
              {loadingUsers ? (
                <div className="text-sm text-muted-foreground py-2">
                  Loading users...
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  No available users (all users are already members)
                </div>
              ) : (
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={setSelectedRole}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admins can manage the team; Members can use resources; Viewers can only view
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedUserId || availableUsers.length === 0}
            >
              {loading ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
