"use client"

import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Bot } from "lucide-react"
import type { Chatbot } from "@/lib/database"
import { getSupabaseBrowserClient } from "@/lib/client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

interface ChatbotAccessManagerProps {
  teamId: string
  chatbots: Chatbot[]
}

export function ChatbotAccessManager({ teamId, chatbots }: ChatbotAccessManagerProps) {
  const [accessMap, setAccessMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseBrowserClient()
  const { toast } = useToast()

  useEffect(() => {
    async function loadAccess() {
      const { data } = await supabase.from("team_chatbot_access").select("chatbot_id").eq("team_id", teamId)

      if (data) {
        const map: Record<string, boolean> = {}
        data.forEach((access) => {
          map[access.chatbot_id] = true
        })
        setAccessMap(map)
      }
      setLoading(false)
    }

    loadAccess()
  }, [teamId])

  const toggleAccess = async (chatbotId: string, hasAccess: boolean) => {
    if (hasAccess) {
      // Grant access
      const { error } = await supabase.from("team_chatbot_access").insert({ team_id: teamId, chatbot_id: chatbotId })

      if (error) {
        toast({
          title: "Error",
          description: "Failed to grant chatbot access",
          variant: "destructive",
        })
        return
      }

      setAccessMap((prev) => ({ ...prev, [chatbotId]: true }))
      toast({
        title: "Access Granted",
        description: "Team can now use this AI assistant",
      })
    } else {
      // Revoke access
      const { error } = await supabase
        .from("team_chatbot_access")
        .delete()
        .eq("team_id", teamId)
        .eq("chatbot_id", chatbotId)

      if (error) {
        toast({
          title: "Error",
          description: "Failed to revoke chatbot access",
          variant: "destructive",
        })
        return
      }

      setAccessMap((prev) => ({ ...prev, [chatbotId]: false }))
      toast({
        title: "Access Revoked",
        description: "Team can no longer use this AI assistant",
      })
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Loading chatbot access...</div>
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {chatbots.map((bot) => (
          <div key={bot.id} className="flex items-start gap-3 p-3 rounded-lg border">
            <Checkbox
              id={`bot-${bot.id}`}
              checked={accessMap[bot.id] || false}
              onCheckedChange={(checked) => toggleAccess(bot.id, checked as boolean)}
            />
            <div className="flex-1">
              <Label htmlFor={`bot-${bot.id}`} className="flex items-center gap-2 cursor-pointer">
                <Bot className="w-4 h-4 text-primary" />
                <span className="font-medium">{bot.name}</span>
              </Label>
              {bot.description && <p className="text-xs text-muted-foreground mt-1">{bot.description}</p>}
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {bot.model}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  temp: {bot.temperature}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
