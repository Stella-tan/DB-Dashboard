"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Loader2, RotateCcw, Database } from "lucide-react"
import type { Chatbot } from "@/lib/database"
import { cn } from "@/lib/utils"
import { getSupabaseBrowserClient } from "@/lib/client"
import { Badge } from "@/components/ui/badge"

interface ChatInterfaceProps {
  chatbot: Chatbot
  databaseId: string | null
}

export function ChatInterface({ chatbot, databaseId }: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [dbInfo, setDbInfo] = useState<{ name: string; tables: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = getSupabaseBrowserClient()

  // #region agent log
  const useChatResult = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: {
        "x-chatbot-id": chatbot.id,
        "x-database-id": databaseId || "",
      },
    }),
  });
  const { messages, sendMessage, status, setMessages } = useChatResult;
  fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/chat-interface.tsx:37',message:'After useChat hook',data:{useChatResultKeys:Object.keys(useChatResult||{}),hasSetMessages:'setMessages' in useChatResult,setMessagesType:typeof setMessages},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  useEffect(() => {
    async function loadDatabaseInfo() {
      if (!databaseId) return

      const { data: db } = await supabase.from("external_databases").select("name").eq("id", databaseId).single()

      const { count } = await supabase
        .from("synced_tables")
        .select("*", { count: "exact", head: true })
        .eq("database_id", databaseId)

      if (db) {
        setDbInfo({ name: db.name, tables: count || 0 })
      }
    }

    loadDatabaseInfo()
  }, [databaseId, supabase])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || status !== "ready") return

    sendMessage({ text: input })
    setInput("")
  }

  const handleReset = () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/chat-interface.tsx:74',message:'handleReset called',data:{setMessagesDefined:setMessages!==undefined,setMessagesType:typeof setMessages,setMessagesIsFunction:typeof setMessages==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (typeof setMessages === 'function') {
      setMessages([])
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chatbot Info Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{chatbot.system_prompt}</p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3 h-3" />
            </Button>
          )}
        </div>
        {dbInfo && (
          <div className="flex items-center gap-2 mt-2">
            <Database className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Connected to <span className="font-medium">{dbInfo.name}</span>
            </span>
            <Badge variant="secondary" className="text-xs">
              {dbInfo.tables} tables
            </Badge>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center text-center space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Start a conversation</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Ask questions about your data, request analysis, or get insights from {chatbot.name}
              </p>
            </div>
            <div className="space-y-2 w-full">
              <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
              <div className="space-y-1">
                {[
                  "Show me the top 10 users by activity",
                  "What's the revenue trend this month?",
                  "Analyze the conversion funnel",
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="w-full text-left px-3 py-2 text-xs rounded-md bg-muted hover:bg-accent transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-2.5",
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {message.parts.map((part, i) =>
                    part.type === "text" ? (
                      <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
                        {part.text}
                      </p>
                    ) : null,
                  )}
                </div>
              </div>
            ))}
            {status === "streaming" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${chatbot.name}...`}
            className="min-h-[60px] max-h-[120px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || status !== "ready"}
            className="h-[60px] w-[60px] flex-shrink-0"
          >
            {status === "streaming" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Model: {chatbot.model} • Temperature: {chatbot.temperature}
        </p>
      </form>
    </div>
  )
}
