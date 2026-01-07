"use client"

import { useState } from "react"
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
import { AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Team } from "@/lib/database"

interface DeleteTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: Team | null
  onSuccess: () => void
}

export function DeleteTeamDialog({
  open,
  onOpenChange,
  team,
  onSuccess,
}: DeleteTeamDialogProps) {
  const [confirmName, setConfirmName] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!team) return

    if (confirmName !== team.name) {
      toast({
        title: "Confirmation Failed",
        description: "Please enter the correct team name to confirm deletion",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/teams?id=${team.id}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Delete failed")
      }

      toast({
        title: "Team Deleted",
        description: `Team "${team.name}" has been deleted`,
      })

      setConfirmName("")
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
      setConfirmName("")
    }
    onOpenChange(open)
  }

  if (!team) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete Team
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Deleting a team will also remove all member associations and permission settings.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-4 bg-destructive/10 rounded-lg mb-4">
            <p className="text-sm font-medium">
              You are about to delete team: <span className="text-destructive">{team.name}</span>
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-name">
              Please type <span className="font-bold">{team.name}</span> to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Enter team name"
              disabled={loading}
            />
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
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || confirmName !== team.name}
          >
            {loading ? "Deleting..." : "Confirm Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
