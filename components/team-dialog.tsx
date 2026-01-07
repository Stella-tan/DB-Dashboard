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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { Team } from "@/lib/database"

interface TeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team?: Team | null // If provided, we're editing; otherwise creating
  onSuccess: () => void
}

export function TeamDialog({ open, onOpenChange, team, onSuccess }: TeamDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const isEditing = !!team

  // Reset form when dialog opens/closes or team changes
  useEffect(() => {
    if (open) {
      setName(team?.name || "")
      setDescription(team?.description || "")
    }
  }, [open, team])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (name.trim().length < 2) {
      toast({
        title: "Validation Error",
        description: "Team name must be at least 2 characters",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const url = "/api/teams"
      const method = isEditing ? "PUT" : "POST"
      const body = isEditing
        ? { id: team.id, name, description }
        : { name, description }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Operation failed")
      }

      toast({
        title: isEditing ? "Team Updated" : "Team Created",
        description: isEditing ? "Team information has been updated" : "New team has been created",
      })

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Team" : "Create New Team"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modify team information and click save"
                : "Fill in the team information to create a new team"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Team Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter team name"
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter team description (optional)"
                disabled={loading}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Processing..." : isEditing ? "Save Changes" : "Create Team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
