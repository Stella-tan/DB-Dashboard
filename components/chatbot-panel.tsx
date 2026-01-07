"use client"

import { useEffect, useState } from "react"
import { X, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Chatbot } from "@/lib/database"
import { ChatInterface } from "./chat-interface"
import { getSupabaseBrowserClient } from "@/lib/client"

interface ChatbotPanelProps {
  chatbots: Chatbot[]
  databaseId: string | null
  onClose: () => void
}

export function ChatbotPanel({ chatbots, databaseId, onClose }: ChatbotPanelProps) {
  const [availableChatbots, setAvailableChatbots] = useState<Chatbot[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    async function loadChatbotsWithAccess() {
      if (!databaseId) {
        setAvailableChatbots(chatbots)
        setLoading(false)
        return
      }

      // Get chatbots that have access to the selected database
      const { data: accessData } = await supabase
        .from("chatbot_database_access")
        .select("chatbot_id")
        .eq("database_id", databaseId)

      if (accessData) {
        const accessibleChatbotIds = accessData.map((a) => a.chatbot_id)
        const filtered = chatbots.filter((bot) => accessibleChatbotIds.includes(bot.id))
        setAvailableChatbots(filtered)
      }

      setLoading(false)
    }

    loadChatbotsWithAccess()
  }, [databaseId, chatbots, supabase])

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">AI Assistants</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-sm text-muted-foreground">Loading chatbots...</div>
        </div>
      </div>
    )
  }

  if (availableChatbots.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">AI Assistants</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <Bot className="w-12 h-12 mb-4 text-muted-foreground" />
          <p className="font-medium mb-2">No Chatbots Available</p>
          <p className="text-sm text-muted-foreground">
            {databaseId
              ? "No chatbots have access to this database"
              : "Please select a database to see available chatbots"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold text-lg">AI Assistants</h2>
          <p className="text-xs text-muted-foreground">{availableChatbots.length} available</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue={availableChatbots[0]?.id} className="flex flex-col flex-1 overflow-hidden">
        <ScrollArea className="border-b">
          <TabsList className="w-full justify-start rounded-none bg-transparent px-4 h-auto py-2">
            {availableChatbots.map((bot) => (
              <TabsTrigger
                key={bot.id}
                value={bot.id}
                className="rounded-lg data-[state=active]:bg-accent flex-col items-start h-auto py-2 px-3"
              >
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  <span className="font-medium text-sm">{bot.name}</span>
                </div>
                {bot.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{bot.description}</p>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        {availableChatbots.map((bot) => (
          <TabsContent key={bot.id} value={bot.id} className="flex-1 m-0 overflow-hidden">
            <ChatInterface chatbot={bot} databaseId={databaseId} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
